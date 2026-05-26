const COS = require('cos-nodejs-sdk-v5');
const StorageAdapter = require('./base');

class TencentCOSAdapter extends StorageAdapter {
  constructor(config, endpoint) {
    super(config, endpoint);
    this.bucket = config.bucket;
    this.region = config.region || 'ap-guangzhou';
    this.cos = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });
  }

  _getBucket() {
    // bucket 格式: bucketname-appid
    return this.bucket;
  }

  async upload(key, buffer, mimeType) {
    const params = {
      Bucket: this._getBucket(),
      Region: this.region,
      Key: key,
      Body: buffer,
    };
    if (mimeType) params.ContentType = mimeType;

    await this.cos.putObject(params);
    return { url: this.getUrl(key) };
  }

  async delete(key) {
    try {
      await this.cos.deleteObject({
        Bucket: this._getBucket(),
        Region: this.region,
        Key: key,
      });
    } catch (err) {
      // NoSuchKey 也算成功
      if (err.statusCode === 204 || err.statusCode === 404) return;
      throw err;
    }
  }

  getUrl(key) {
    if (this.endpoint) {
      return `${this.endpoint}/${key}`;
    }
    // 使用默认域名: https://{bucket}.cos.{region}.myqcloud.com/{key}
    return `https://${this._getBucket()}.cos.${this.region}.myqcloud.com/${key}`;
  }

  async list(prefix, marker = null, limit = 1000) {
    return new Promise((resolve, reject) => {
      const params = {
        Bucket: this._getBucket(),
        Region: this.region,
        Prefix: prefix,
        MaxKeys: limit,
      };
      if (marker) params.Marker = marker;

      this.cos.getBucket(params, (err, data) => {
        if (err) return reject(err);
        const items = (data.Contents || []).map(item => ({
          key: item.Key,
          size: parseInt(item.Size, 10),
          lastModified: item.LastModified,
        }));
        resolve({
          items,
          nextMarker: data.IsTruncated ? data.NextMarker : null,
        });
      });
    });
  }

  async test() {
    try {
      const result = await this.list('', null, 1);
      const hasFiles = result.items.length > 0;
      return { success: true, message: hasFiles ? '连接成功，存储桶中有文件' : '连接成功，存储桶为空' };
    } catch (err) {
      let msg = err.message;
      if (err.statusCode === 403) {
        msg = '认证失败或权限不足，请检查 SecretId、SecretKey 和 Bucket 是否正确';
      } else if (err.statusCode === 404) {
        msg = '存储桶不存在，请检查 Bucket 名称和区域(Region)是否匹配';
      } else if (err.code === 'InvalidAccessKeyId' || err.code === 'SignatureDoesNotMatch') {
        msg = '认证失败，请检查 SecretId、SecretKey 是否正确';
      }
      return { success: false, message: `连接失败: ${msg}` };
    }
  }
}

module.exports = TencentCOSAdapter;
