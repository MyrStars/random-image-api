const crypto = require('crypto');

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ALPHABET_LEN = alphabet.length;

// 无模偏差的随机字节映射
// 使用拒绝采样法：只使用小于 MAX_REJECT_THRESHOLD 的字节值
// MAX_REJECT_THRESHOLD = floor(256 / ALPHABET_LEN) * ALPHABET_LEN
const MAX_REJECT_THRESHOLD = Math.floor(256 / ALPHABET_LEN) * ALPHABET_LEN; // 246

function nanoid(size = 12) {
  const bytes = crypto.randomBytes(size * 2); // 多生成一些，以防拒绝采样
  let id = '';
  let byteIndex = 0;

  while (id.length < size && byteIndex < bytes.length) {
    const byte = bytes[byteIndex++];
    // 拒绝采样：只使用均匀分布范围内的值
    if (byte < MAX_REJECT_THRESHOLD) {
      id += alphabet[byte % ALPHABET_LEN];
    }
  }

  // 如果运气不好全部被拒绝了（极低概率），递归重试
  if (id.length < size) {
    return nanoid(size);
  }

  return id;
}

module.exports = { nanoid };
