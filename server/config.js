const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
};
