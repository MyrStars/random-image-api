const express = require('express');
const router = express.Router();

// 公开API - 随机图片
router.use('/api', require('./api'));

// 管理后台API
router.use('/admin/api', require('./admin/auth'));
router.use('/admin/api/storages', require('./admin/storages'));
router.use('/admin/api/categories', require('./admin/categories'));
router.use('/admin/api/images', require('./admin/images'));
router.use('/admin/api/stats', require('./admin/dashboard'));
router.use('/admin/api/db', require('./admin/dbbrowser'));
router.use('/admin/api/settings', require('./admin/settings'));

module.exports = router;
