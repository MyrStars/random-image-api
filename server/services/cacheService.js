/**
 * 内存缓存服务
 * 用于缓存分类的图片列表，避免每次请求都查数据库
 * 支持最大容量限制和LRU淘汰策略
 */
class CacheService {
  constructor() {
    this.cache = new Map(); // key -> { data, expireAt, lastAccess }
  }

  /**
   * 获取当前最大缓存条目数（动态读取配置）
   */
  get maxSize() {
    try {
      const config = require('../config');
      return config.cacheMaxSize || 500;
    } catch {
      return 500;
    }
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return null;
    }
    // 更新最后访问时间（LRU）
    entry.lastAccess = Date.now();
    return entry.data;
  }

  set(key, data, ttlSeconds) {
    // 如果超过容量，淘汰最久未访问的条目
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evict();
    }
    this.cache.set(key, {
      data,
      expireAt: Date.now() + ttlSeconds * 1000,
      lastAccess: Date.now(),
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  /**
   * 淘汰最久未访问的10%条目（LRU策略）
   */
  _evict() {
    // 先清理过期的
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expireAt) {
        this.cache.delete(key);
      }
    }
    // 如果仍然超容量，按LRU淘汰
    if (this.cache.size >= this.maxSize) {
      const entries = [...this.cache.entries()]
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      const evictCount = Math.max(1, Math.floor(this.maxSize * 0.1));
      for (let i = 0; i < evictCount && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
}

// 单例
module.exports = new CacheService();
