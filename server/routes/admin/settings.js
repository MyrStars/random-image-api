const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const config = require('../../config');
const crypto = require('crypto');

router.use(auth);

/**
 * GET /admin/api/settings
 * 获取所有系统配置（敏感值脱敏）
 */
router.get('/', (req, res) => {
  try {
    const settings = config.getAllSettings();
    const meta = config.SETTINGS_META;
    res.json({ code: 0, data: { settings, meta } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * PUT /admin/api/settings
 * 批量更新系统配置
 */
router.put('/', (req, res) => {
  try {
    const updates = req.body;
    const meta = config.SETTINGS_META;
    const changes = [];
    const warnings = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!meta[key]) continue;
      if (meta[key].readonly) continue;

      // 密码类字段：如果值包含 **** 说明没有修改，跳过
      if (meta[key].secret && typeof value === 'string' && value.includes('****')) {
        continue;
      }

      // 数值类型验证
      if (meta[key].type === 'number') {
        const num = parseInt(value);
        if (isNaN(num)) {
          return res.status(400).json({ code: 400, message: `${meta[key].label} 必须是数字` });
        }
        if (meta[key].min !== undefined && num < meta[key].min) {
          return res.status(400).json({ code: 400, message: `${meta[key].label} 不能小于 ${meta[key].min}` });
        }
        if (meta[key].max !== undefined && num > meta[key].max) {
          return res.status(400).json({ code: 400, message: `${meta[key].label} 不能大于 ${meta[key].max}` });
        }
        config.setSetting(key, num);
        changes.push(key);
      } else {
        if (!value || !value.trim()) {
          return res.status(400).json({ code: 400, message: `${meta[key].label} 不能为空` });
        }
        config.setSetting(key, value.trim());
        changes.push(key);
      }

      // 收集警告信息
      if (meta[key].warning) {
        warnings.push({ key, message: meta[key].warning });
      }
      if (meta[key].restart) {
        warnings.push({ key, message: `${meta[key].label} 修改后需要重启服务才能生效` });
      }
    }

    res.json({
      code: 0,
      message: `已更新 ${changes.length} 项配置`,
      data: { changes, warnings },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/api/settings/generate-key
 * 生成随机密钥
 */
router.post('/generate-key', (req, res) => {
  try {
    const { type } = req.body;
    let key;
    switch (type) {
      case 'jwtSecret':
        key = crypto.randomBytes(32).toString('hex');
        break;
      case 'encryptKey':
        key = crypto.randomBytes(8).toString('hex'); // 16字符 = 16字节 for AES-128
        break;
      case 'adminPass':
        key = crypto.randomBytes(8).toString('hex');
        break;
      default:
        return res.status(400).json({ code: 400, message: '未知的密钥类型' });
    }
    res.json({ code: 0, data: { key } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/api/settings/test
 * 测试当前配置是否正常工作（检查密钥解密等）
 */
router.post('/test', (req, res) => {
  try {
    const results = [];

    // 测试加密解密
    const { encrypt, decrypt } = require('../../utils/crypto');
    const testVal = 'test-加密测试-' + Date.now();
    try {
      const enc = encrypt(testVal);
      const dec = decrypt(enc);
      results.push({ item: '加密解密', status: dec === testVal ? 'ok' : 'fail', message: dec === testVal ? '正常' : '解密结果不匹配' });
    } catch (e) {
      results.push({ item: '加密解密', status: 'fail', message: e.message });
    }

    // 测试数据库
    try {
      const { getDb } = require('../../database');
      const db = getDb();
      db.prepare('SELECT 1').get();
      results.push({ item: '数据库', status: 'ok', message: '正常' });
    } catch (e) {
      results.push({ item: '数据库', status: 'fail', message: e.message });
    }

    // 测试存储源密钥解密
    try {
      const { getDb } = require('../../database');
      const db = getDb();
      const storages = db.prepare('SELECT id, name, config FROM storage_configs').all();
      let allOk = true;
      for (const s of storages) {
        try { JSON.parse(decrypt(s.config)); } catch { allOk = false; break; }
      }
      if (storages.length === 0) {
        results.push({ item: '存储源密钥', status: 'ok', message: '暂无存储源' });
      } else {
        results.push({ item: '存储源密钥', status: allOk ? 'ok' : 'fail', message: allOk ? `全部正常（${storages.length}个）` : '部分存储源密钥解密失败' });
      }
    } catch (e) {
      results.push({ item: '存储源密钥', status: 'fail', message: e.message });
    }

    const allOk = results.every(r => r.status === 'ok');
    res.json({ code: 0, data: { results, allOk } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

module.exports = router;
