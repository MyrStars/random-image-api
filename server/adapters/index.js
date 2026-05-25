const QiniuAdapter = require('./qiniu');

const adapters = {
  qiniu: QiniuAdapter,
  // 后续扩展:
  // aliyun_oss: AliyunOSSAdapter,
  // tencent_cos: TencentCOSAdapter,
  // cloudflare_r2: CloudflareR2Adapter,
  // minio: MinioAdapter,
};

/**
 * 创建存储适配器实例
 * @param {string} type - 存储类型
 * @param {object} config - 存储配置（已解密）
 * @param {string} endpoint - 公开访问域名
 * @returns {StorageAdapter}
 */
function createAdapter(type, config, endpoint) {
  const AdapterClass = adapters[type];
  if (!AdapterClass) {
    throw new Error(`不支持的存储类型: ${type}，当前支持: ${Object.keys(adapters).join(', ')}`);
  }
  return new AdapterClass(config, endpoint);
}

/**
 * 获取当前支持的存储类型列表
 */
function getSupportedTypes() {
  return Object.keys(adapters).map(key => {
    const names = {
      qiniu: '七牛云',
      aliyun_oss: '阿里云OSS',
      tencent_cos: '腾讯云COS',
      cloudflare_r2: 'Cloudflare R2',
      minio: 'MinIO',
    };
    return { type: key, name: names[key] || key };
  });
}

module.exports = { createAdapter, getSupportedTypes };
