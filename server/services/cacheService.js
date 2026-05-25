/**
 * 简单的内存缓存服务
 * 用于缓存分类的图片列表，避免每次请求都查数据库
 */
class CacheService {
  constructor() {
    this.cache = new Map(); // key -> { data, expireAt }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data, ttlSeconds) {
    this.cache.set(key, {
      data,
      expireAt: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  /**
   * 使匹配指定前缀的所有缓存失效
   */
  delByPrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// 单例
module.exports = new CacheService();
