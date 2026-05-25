const QiniuAdapter = require('./qiniu');

// 存储类型注册表（只包含已实现的适配器）
const adapters = {
  qiniu: { name: '七牛云', Adapter: QiniuAdapter },
};

function createAdapter(type, config, endpoint) {
  const entry = adapters[type];
  if (!entry) {
    throw new Error(`不支持的存储类型: ${type}，当前支持: ${Object.keys(adapters).join(', ')}`);
  }
  return new entry.Adapter(config, endpoint);
}

function getSupportedTypes() {
  return Object.entries(adapters).map(([type, entry]) => ({ type, name: entry.name }));
}

module.exports = { createAdapter, getSupportedTypes };
