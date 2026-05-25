const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const StorageAdapter = require('./base');

class CloudflareR2Adapter extends StorageAdapter {
  constructor(config, endpoint) {
    super(config, endpoint);
    this.bucket = config.bucket;
    // R2 使用 S3 兼容接口，endpoint 为 R2 的 API endpoint
    // 格式: https://{account_id}.r2.cloudflarestorage.com
    this.r2Endpoint = config.endpoint || '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: this.r2Endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(key, buffer, mimeType) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
    };
    if (mimeType) params.ContentType = mimeType;

    await this.client.send(new PutObjectCommand(params));
    return { url: this.getUrl(key) };
  }

  async delete(key) {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
    } catch (err) {
      // NoSuchKey 也算成功
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return;
      throw err;
    }
  }

  getUrl(key) {
    // R2 公开访问需要绑定自定义域名，或使用 R2.dev 公开 URL
    if (this.endpoint) {
      return `${this.endpoint}/${key}`;
    }
    // 如果没有自定义域名，使用 R2 的公共 URL 格式
    // 注意：需要在 R2 设置中启用公共访问
    return `https://${this.bucket}.${this.r2Endpoint.replace('https://', '').replace('.r2.cloudflarestorage.com', '')}.r2.dev/${key}`;
  }

  async list(prefix, marker = null, limit = 1000) {
    const params = {
      Bucket: this.bucket,
      Prefix: prefix || undefined,
      MaxKeys: limit,
    };
    if (marker) params.StartAfter = marker;

    const result = await this.client.send(new ListObjectsV2Command(params));
    const items = (result.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
    }));

    return {
      items,
      nextMarker: result.IsTruncated ? (result.NextContinuationToken || items[items.length - 1]?.key) : null,
    };
  }

  async test() {
    try {
      const result = await this.list('', null, 1);
      return { success: true, message: '连接成功，存储桶中有文件' };
    } catch (err) {
      let msg = err.message;
      if (err.name === 'InvalidAccessKeyId' || err.name === 'SignatureDoesNotMatch') {
        msg = '认证失败，请检查 AccessKeyId 和 SecretAccessKey 是否正确';
      } else if (err.name === 'NoSuchBucket') {
        msg = '存储桶不存在，请检查 Bucket 名称';
      } else if (err.$metadata?.httpStatusCode === 403) {
        msg = '权限不足，请检查 R2 API Token 权限';
      } else if (err.$metadata?.httpStatusCode === 401) {
        msg = '认证失败，请检查 R2 API Endpoint、AccessKeyId 和 SecretAccessKey';
      }
      return { success: false, message: `连接失败: ${msg}` };
    }
  }
}

module.exports = CloudflareR2Adapter;
