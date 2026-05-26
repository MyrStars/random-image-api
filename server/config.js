const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 检查是否使用了不安全的默认值（仅在生产环境警告）
const isDefaultJWT = !process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_change_me';
const isDefaultEncryptKey = !process.env.ENCRYPT_KEY || process.env.ENCRYPT_KEY === '0123456789abcdef';
const isDefaultPassword = !process.env.ADMIN_PASS || process.env.ADMIN_PASS === 'admin123';

if (isDefaultJWT || isDefaultEncryptKey || isDefaultPassword) {
  console.warn('\n⚠️  安全警告：检测到使用默认密钥/密码，请在 .env 中修改以下配置：');
  if (isDefaultPassword) console.warn('   - ADMIN_PASS: 当前为默认值，极易被猜到');
  if (isDefaultJWT) console.warn('   - JWT_SECRET: 当前为默认值，攻击者可伪造Token');
  if (isDefaultEncryptKey) console.warn('   - ENCRYPT_KEY: 当前为默认值，存储密钥可被解密');
  console.warn('   参考快速生成: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
}

module.exports = {
  port: parseInt(process.env.PORT) || 3100,
  admin: {
    user: process.env.ADMIN_USER || 'admin',
    pass: process.env.ADMIN_PASS || 'admin123',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: '7d',
  },
  encryptKey: process.env.ENCRYPT_KEY || '0123456789abcdef',
  dbPath: path.resolve(process.env.DB_PATH || './data/images.db'),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3100').replace(/\/$/, ''),
  // CORS 允许的来源（逗号分隔，* 表示全部允许）
  corsOrigins: process.env.CORS_ORIGINS || '*',
};
