const express = require('express');
const router = express.Router();
const imageService = require('../services/imageService');
const fetch = require('node-fetch');
const { Jimp } = require('jimp');
const { getMimeType, isImage } = require('../utils/imageInfo');

// 图片缩放最大尺寸限制，防止DoS
const MAX_RESIZE_DIMENSION = 4096;

// 代理模式允许的URL协议，防止SSRF
const ALLOWED_PROTOCOLS = ['https:', 'http:'];

// SSRF防护：禁止访问内网地址
function isPrivateUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return true;
    const hostname = url.hostname;
    // 禁止访问localhost和内网地址
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
    if (hostname === '::1') return true;
    // 10.0.0.0/8
    if (/^10\./.test(hostname)) return true;
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    // 192.168.0.0/16
    if (/^192\.168\./.test(hostname)) return true;
    // 169.254.0.0/16 (云元数据)
    if (/^169\.254\./.test(hostname)) return true;
    return false;
  } catch {
    return true;
  }
}

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
        // SSRF防护：检查URL是否指向内网
        if (isPrivateUrl(image.url)) {
          return res.status(400).json({ code: 400, message: '不允许代理该地址' });
        }

        const response = await fetch(image.url);
        if (!response.ok) {
          return res.status(502).json({ code: 502, message: '获取图片失败' });
        }

        let buffer = await response.buffer();

        // 如果指定了尺寸，进行缩放
        if (needResize) {
          let targetW = w ? parseInt(w) : null;
          let targetH = h ? parseInt(h) : null;

          // 尺寸上限保护，防止DoS
          if (targetW && targetW > MAX_RESIZE_DIMENSION) targetW = MAX_RESIZE_DIMENSION;
          if (targetH && targetH > MAX_RESIZE_DIMENSION) targetH = MAX_RESIZE_DIMENSION;

          if ((targetW && targetW > 0) || (targetH && targetH > 0)) {
            const img = await Jimp.fromBuffer(buffer);
            const origW = img.width;
            const origH = img.height;

            if (mode === 'stretch' && targetW && targetH) {
              img.resize({ w: targetW, h: targetH });
            } else if (mode === 'fill' && targetW && targetH) {
              const scaleW = targetW / origW;
              const scaleH = targetH / origH;
              const scale = Math.max(scaleW, scaleH);
              const newW = Math.round(origW * scale);
              const newH = Math.round(origH * scale);
              img.resize({ w: newW, h: newH });
              const cropX = Math.max(0, Math.round((newW - targetW) / 2));
              const cropY = Math.max(0, Math.round((newH - targetH) / 2));
              img.crop({ x: cropX, y: cropY, w: targetW, h: targetH });
            } else {
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

            // 保持原格式输出
            const mime = image.mime_type || 'image/jpeg';
            buffer = await img.getBuffer(mime);
          }
        }

        res.set('Content-Type', image.mime_type || 'image/jpeg');
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
