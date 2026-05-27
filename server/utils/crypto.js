const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-128-cbc';
// ENCRYPT_KEY 为 32 位 hex 字符串，解码后得到 16 字节（AES-128 所需长度）
const KEY = Buffer.from(config.encryptKey, 'hex');

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedText; // 兼容未加密的旧数据
  }
}

module.exports = { encrypt, decrypt };
