const express = require('express');
const router = express.Router();
const imageService = require('../services/imageService');
const fetch = require('node-fetch');
const { Jimp } = require('jimp');

/**
 * GET /api/:slug
 * 随机图片API
 *
 * 查询参数:
 *   format=json  -> 返回JSON
 *   type=raw     -> 代理模式，返回图片二进制
 *   w=500        -> 指定宽度（自动切换代理模式）
 *   h=200        -> 指定高度（自动切换代理模式）
 *   mode=fit     -> 缩放模式: fit(适应) | fill(填充裁剪) | stretch(拉伸)
 *   默认         -> 302重定向
 *
 * 示例:
 *   /api/wallpaper              -> 302重定向原图
 *   /api/wallpaper?w=500&h=300  -> 返回500x300的图片（fit模式）
 *   /api/wallpaper?w=500        -> 宽度500，高度按比例
 *   /api/wallpaper?h=300        -> 高度300，宽度按比例
 *   /api/wallpaper?w=500&h=300&mode=fill   -> 填充模式，可能裁剪
 *   /api/wallpaper?w=500&h=300&mode=stretch -> 拉伸模式，可能变形
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { format, type, w, h, mode = 'fit' } = req.query;

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

    // 需要调整尺寸 -> 自动使用代理模式
    const needResize = w || h;

    // 代理模式
    if (type === 'raw' || needResize) {
      try {
        const response = await fetch(image.url);
        if (!response.ok) {
          return res.status(502).json({ code: 502, message: '获取图片失败' });
        }

        let buffer = await response.buffer();

        // 如果指定了尺寸，进行缩放
        if (needResize) {
          const targetW = w ? parseInt(w) : null;
          const targetH = h ? parseInt(h) : null;

          if ((targetW && targetW > 0) || (targetH && targetH > 0)) {
            const img = await Jimp.fromBuffer(buffer);
            const origW = img.width;
            const origH = img.height;

            if (mode === 'stretch' && targetW && targetH) {
              // 拉伸模式：强制目标尺寸
              img.resize({ w: targetW, h: targetH });
            } else if (mode === 'fill' && targetW && targetH) {
              // 填充模式：缩放填满后裁剪
              const scaleW = targetW / origW;
              const scaleH = targetH / origH;
              const scale = Math.max(scaleW, scaleH);
              const newW = Math.round(origW * scale);
              const newH = Math.round(origH * scale);
              img.resize({ w: newW, h: newH });
              // 居中裁剪
              const cropX = Math.max(0, Math.round((newW - targetW) / 2));
              const cropY = Math.max(0, Math.round((newH - targetH) / 2));
              img.crop({ x: cropX, y: cropY, w: targetW, h: targetH });
            } else {
              // 适应模式（默认）：保持比例缩放到目标尺寸内
              if (targetW && targetH) {
                const scaleW = targetW / origW;
                const scaleH = targetH / origH;
                const scale = Math.min(scaleW, scaleH);
                img.resize({ w: Math.round(origW * scale), h: Math.round(origH * scale) });
              } else if (targetW) {
                const scale = targetW / origW;
                img.resize({ w: targetW, h: Math.round(origH * scale) });
              } else {
                const scale = targetH / origH;
                img.resize({ w: Math.round(origW * scale), h: targetH });
              }
            }

            buffer = await img.getBuffer(Jimp.MIME_JPEG);
          }
        }

        res.set('Content-Type', needResize ? 'image/jpeg' : (image.mime_type || 'image/jpeg'));
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      } catch (err) {
        console.error('[Proxy Error]', err.message);
        return res.status(502).json({ code: 502, message: '代理获取图片失败: ' + err.message });
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
