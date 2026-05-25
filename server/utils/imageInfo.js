const probe = require('probe-image-size');

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
};

function getMimeType(filename) {
  const ext = require('path').extname(filename).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

function isImage(filename) {
  const ext = require('path').extname(filename).toLowerCase();
  return ext in MIME_MAP;
}

/**
 * 解析图片元数据（宽高）
 * @param {Buffer} buffer - 图片二进制数据
 * @returns {{ width: number, height: number }}
 */
async function getImageDimensions(buffer) {
  try {
    const result = probe.sync(buffer);
    if (result) {
      return { width: result.width || 0, height: result.height || 0 };
    }
    return { width: 0, height: 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

module.exports = { getMimeType, isImage, getImageDimensions };
