const express = require('express');
const router = express.Router();
const imageService = require('../services/imageService');
const { createAdapter } = require('../adapters');
const { decrypt } = require('../utils/crypto');
const db = require('../database');
const fetch = require('node-fetch');

/**
 * GET /api/:slug
 * 随机图片API
 * 查询参数:
 *   format=json  -> 返回JSON
 *   type=raw     -> 代理模式，返回图片二进制
 *   默认         -> 302重定向
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { format, type } = req.query;

    const image = imageService.getRandomImage(slug);
    if (!image) {
      return res.status(404).json({ code: 404, message: '分类不存在或没有图片' });
    }

    // JSON模式
    if (format === 'json') {
      return res.json({
        code: 0,
        data: {
          url: image.url,
          width: image.width,
          height: image.height,
          size: image.size,
          mime_type: image.mime_type,
        },
      });
    }

    // 代理模式 - 从存储源获取图片并返回
    if (type === 'raw') {
      try {
        const response = await fetch(image.url);
        if (!response.ok) {
          return res.status(502).json({ code: 502, message: '获取图片失败' });
        }
        const buffer = await response.buffer();
        res.set('Content-Type', image.mime_type || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      } catch {
        return res.status(502).json({ code: 502, message: '代理获取图片失败' });
      }
    }

    // 默认: 302重定向
    res.redirect(302, image.url);
  } catch (err) {
    console.error('[API Error]', err.message);
    res.status(500).json({ code: 500, message: '服务器内部错误' });
  }
});

module.exports = router;
