const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const router = express.Router();

/**
 * POST /admin/api/login
 * 登录接口
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === config.admin.user && password === config.admin.pass) {
    const token = jwt.sign({ user: username }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
    return res.json({ code: 0, data: { token, user: username } });
  }

  res.status(401).json({ code: 401, message: '用户名或密码错误' });
});

/**
 * GET /admin/api/me
 * 获取当前用户信息
 */
router.get('/me', require('../../middleware/auth'), (req, res) => {
  res.json({ code: 0, data: { user: req.user.user } });
});

module.exports = router;
