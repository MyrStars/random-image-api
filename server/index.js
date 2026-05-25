const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initDatabase, startAutoSave } = require('./database');

async function main() {
  // 初始化数据库
  await initDatabase();
  startAutoSave();

  const routes = require('./routes');
  const errorHandler = require('./middleware/errorHandler');

  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  app.listen(config.port, () => {
    console.log(`随机图片API服务已启动: http://localhost:${config.port}`);
    console.log(`管理后台: http://localhost:${config.port}/admin`);
    console.log(`随机图片API示例: http://localhost:${config.port}/api/{slug}`);
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
