const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initDatabase, startAutoSave, stopAutoSave, getDb } = require('./database');

async function main() {
  // 初始化数据库
  await initDatabase();

  // 从数据库加载运行时配置（覆盖 .env 默认值）
  config.loadFromDatabase();

  startAutoSave();

  const routes = require('./routes');
  const errorHandler = require('./middleware/errorHandler');

  const app = express();

  // CORS 白名单配置
  const corsOptions = {
    origin: function (origin, callback) {
      const allowed = config.corsOrigins;
      if (allowed === '*') {
        callback(null, true);
      } else {
        const allowedList = allowed.split(',').map(s => s.trim());
        // 允许无origin的请求（如服务端请求、Postman）
        if (!origin || allowedList.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy: origin not allowed'));
        }
      }
    },
    credentials: true,
  };
  app.use(cors(corsOptions));

  // 简易请求频率限制
  const rateLimitMap = new Map();
  const RATE_WINDOW = 60 * 1000; // 1分钟

  app.use('/admin/api/login', (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, start: now };
    if (now - entry.start > RATE_WINDOW) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count++;
    }
    rateLimitMap.set(key, entry);
    if (entry.count > config.rateLimitLogin) {
      return res.status(429).json({ code: 429, message: '请求过于频繁，请稍后再试' });
    }
    next();
  });

  app.use('/api/', (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, start: now };
    if (now - entry.start > RATE_WINDOW) {
      entry.count = 1;
      entry.start = now;
    } else {
      entry.count++;
    }
    rateLimitMap.set(key, entry);
    if (entry.count > config.rateLimitPublic) {
      return res.status(429).json({ code: 429, message: '请求过于频繁，请稍后再试' });
    }
    next();
  });

  // 定期清理过期的频率限制记录
  const rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.start > RATE_WINDOW * 2) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // 中间件
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 静态文件 - 前端构建产物
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use('/admin', express.static(clientDist));

  // API路由
  app.use(routes);

  // 前端SPA fallback - /admin下的非API请求都返回index.html
  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  // 根路径重定向到管理后台
  app.get('/', (req, res) => {
    res.redirect('/admin');
  });

  // 错误处理
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`随机图片API服务已启动: http://localhost:${config.port}`);
    console.log(`管理后台: http://localhost:${config.port}/admin`);
    console.log(`随机图片API示例: http://localhost:${config.port}/api/{slug}`);
  });

  // 注册热更新回调：配置变更时无需重启即可生效
  config.onHotReload((key, value, oldValue) => {
    if (key === 'port' && value !== oldValue) {
      // 端口变更：关闭旧监听，开启新端口
      const oldPort = oldValue;
      const newPort = value;
      console.log(`[HotReload] 端口变更: ${oldPort} → ${newPort}，正在切换...`);
      server.close(() => {
        server.listen(newPort, () => {
          console.log(`[HotReload] 服务已切换到新端口: http://localhost:${newPort}`);
        });
      });
    }

    if (key === 'autoSaveInterval' && value !== oldValue) {
      // 保存间隔变更：重启自动保存定时器
      console.log(`[HotReload] 自动保存间隔变更: ${oldValue}s → ${value}s，重启定时器...`);
      stopAutoSave();
      startAutoSave();
    }
  });

  // 优雅关闭：保存数据库后退出
  function gracefulShutdown(signal) {
    console.log(`\n收到 ${signal} 信号，正在保存数据库并关闭...`);
    clearInterval(rateLimitCleanupTimer);
    stopAutoSave();
    try {
      getDb().save();
      console.log('数据库已保存');
    } catch (e) {
      console.error('数据库保存失败:', e.message);
    }
    server.close(() => {
      console.log('服务已关闭');
      process.exit(0);
    });
    // 超时强制退出
    setTimeout(() => process.exit(1), 5000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
