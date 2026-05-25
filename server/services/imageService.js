const { getDb } = require('../database');
const db = new Proxy({}, { get(_, prop) { return getDb()[prop]; } });
const cache = require('./cacheService');
const { createAdapter } = require('../adapters');
const { decrypt } = require('../utils/crypto');
const { getMimeType, isImage, getImageDimensions } = require('../utils/imageInfo');

const CACHE_PREFIX = 'images:';

/**
 * 获取随机图片
 * @param {string} slug - 分类slug
 * @returns {{ url: string, width: number, height: number, size: number, mime_type: string }|null}
 */
function getRandomImage(slug) {
  const cacheKey = CACHE_PREFIX + slug;

  // 先从缓存中获取该分类下的所有图片
  let images = cache.get(cacheKey);

  if (!images) {
    // 查数据库
    const category = db.prepare('SELECT id, cache_ttl FROM categories WHERE slug = ? AND status = 1').get(slug);
    if (!category) return null;

    images = db.prepare(
      'SELECT url, width, height, size, mime_type FROM images WHERE category_id = ?'
    ).all(category.id);

    if (!images.length) return null;

    cache.set(cacheKey, images, category.cache_ttl);
  }

  if (!images.length) return null;

  // 随机选取一张
  const index = Math.floor(Math.random() * images.length);
  return images[index];
}

/**
 * 获取分类信息
 */
function getCategoryBySlug(slug) {
  return db.prepare(`
    SELECT c.*, s.name as storage_name, s.type as storage_type
    FROM categories c
    LEFT JOIN storage_configs s ON c.storage_id = s.id
    WHERE c.slug = ?
  `).get(slug);
}

/**
 * 获取适配器实例（从数据库读取存储配置）
 */
function getAdapter(storageId) {
  const storage = db.prepare('SELECT * FROM storage_configs WHERE id = ?').get(storageId);
  if (!storage) throw new Error('存储源不存在');

  const config = JSON.parse(decrypt(storage.config));
  return createAdapter(storage.type, config, storage.endpoint);
}

/**
 * 上传图片
 */
async function uploadImage(categoryId, fileBuffer, filename) {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) throw new Error('分类不存在');

  const adapter = getAdapter(category.storage_id);
  const { nanoid } = require('../utils/nanoid');
  const ext = require('path').extname(filename);
  const key = `${category.storage_path}${nanoid()}${ext}`;
  const mimeType = getMimeType(filename);

  // 上传到存储
  const result = await adapter.upload(key, fileBuffer, mimeType);

  // 解析图片宽高
  const { width, height } = await getImageDimensions(fileBuffer);

  // 写入数据库
  const stmt = db.prepare(`
    INSERT INTO images (category_id, filename, storage_key, url, size, width, height, mime_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(categoryId, filename, key, result.url, fileBuffer.length, width, height, mimeType);

  // 清除缓存
  cache.del(CACHE_PREFIX + category.slug);

  return {
    id: info.lastInsertRowid,
    filename,
    storage_key: key,
    url: result.url,
    size: fileBuffer.length,
    width,
    height,
    mime_type: mimeType,
  };
}

/**
 * 删除图片
 */
async function deleteImage(imageId) {
  const image = db.prepare(`
    SELECT i.*, c.slug, c.storage_id
    FROM images i
    JOIN categories c ON i.category_id = c.id
    WHERE i.id = ?
  `).get(imageId);

  if (!image) throw new Error('图片不存在');

  const adapter = getAdapter(image.storage_id);
  await adapter.delete(image.storage_key);

  db.prepare('DELETE FROM images WHERE id = ?').run(imageId);
  cache.del(CACHE_PREFIX + image.slug);

  return true;
}

/**
 * 批量删除图片
 */
async function deleteImages(imageIds) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const id of imageIds) {
    try {
      await deleteImage(id);
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({ id, error: err.message });
    }
  }

  return results;
}

/**
 * 从存储源同步图片列表到数据库
 */
async function syncFromStorage(categoryId) {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
  if (!category) throw new Error('分类不存在');

  const adapter = getAdapter(category.storage_id);

  // 已存在的storage_key集合
  const existing = new Set(
    db.prepare('SELECT storage_key FROM images WHERE category_id = ?')
      .all(categoryId)
      .map(r => r.storage_key)
  );

  let added = 0;
  let marker = null;
  let hasMore = true;

  while (hasMore) {
    const result = await adapter.list(category.storage_path, marker, 1000);

    for (const item of result.items) {
      if (existing.has(item.key)) continue;
      if (!isImage(item.key)) continue;

      const filename = require('path').basename(item.key);
      const url = adapter.getUrl(item.key);
      const mimeType = getMimeType(filename);

      db.prepare(`
        INSERT OR IGNORE INTO images (category_id, filename, storage_key, url, size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(categoryId, filename, item.key, url, item.size, mimeType);

      added++;
    }

    marker = result.nextMarker;
    hasMore = !!marker;
  }

  // 清除缓存
  cache.del(CACHE_PREFIX + category.slug);

  return { added, total: existing.size + added };
}

/**
 * 获取图片列表（分页）
 */
function getImages(categoryId, page = 1, size = 20) {
  const offset = (page - 1) * size;
  const total = db.prepare('SELECT COUNT(*) as count FROM images WHERE category_id = ?').get(categoryId).count;
  const items = db.prepare(
    'SELECT * FROM images WHERE category_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(categoryId, size, offset);

  return { items, total, page, size, pages: Math.ceil(total / size) };
}

/**
 * 存储源 CRUD
 */
function getStorages() {
  return db.prepare('SELECT id, name, type, endpoint, status, created_at, updated_at FROM storage_configs').all();
}

function getStorageById(id) {
  return db.prepare('SELECT * FROM storage_configs WHERE id = ?').get(id);
}

function createStorage(data) {
  const { encrypt } = require('../utils/crypto');
  const stmt = db.prepare(`
    INSERT INTO storage_configs (name, type, config, endpoint, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(data.name, data.type, encrypt(JSON.stringify(data.config)), data.endpoint, data.status ?? 1);
  return { id: info.lastInsertRowid, ...data };
}

function updateStorage(id, data) {
  const { encrypt } = require('../utils/crypto');
  const fields = [];
  const values = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
  if (data.config !== undefined) { fields.push('config = ?'); values.push(encrypt(JSON.stringify(data.config))); }
  if (data.endpoint !== undefined) { fields.push('endpoint = ?'); values.push(data.endpoint); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE storage_configs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteStorage(id) {
  // 检查是否有关联的分类
  const count = db.prepare('SELECT COUNT(*) as count FROM categories WHERE storage_id = ?').get(id).count;
  if (count > 0) throw new Error('该存储源下还有分类，请先删除关联分类');
  db.prepare('DELETE FROM storage_configs WHERE id = ?').run(id);
}

/**
 * 分类 CRUD
 */
function getCategories() {
  return db.prepare(`
    SELECT c.*, s.name as storage_name, s.type as storage_type,
      (SELECT COUNT(*) FROM images WHERE category_id = c.id) as image_count
    FROM categories c
    LEFT JOIN storage_configs s ON c.storage_id = s.id
    ORDER BY c.id ASC
  `).all();
}

function getCategoryById(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function createCategory(data) {
  const stmt = db.prepare(`
    INSERT INTO categories (name, slug, description, storage_id, storage_path, status, cache_ttl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.name,
    data.slug,
    data.description || '',
    data.storage_id,
    data.storage_path,
    data.status ?? 1,
    data.cache_ttl ?? 300
  );
  return { id: info.lastInsertRowid, ...data };
}

function updateCategory(id, data) {
  const fields = [];
  const values = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.storage_id !== undefined) { fields.push('storage_id = ?'); values.push(data.storage_id); }
  if (data.storage_path !== undefined) { fields.push('storage_path = ?'); values.push(data.storage_path); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.cache_ttl !== undefined) { fields.push('cache_ttl = ?'); values.push(data.cache_ttl); }
  values.push(id);

  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // 清除该分类的缓存
  const cat = db.prepare('SELECT slug FROM categories WHERE id = ?').get(id);
  if (cat) cache.del(CACHE_PREFIX + cat.slug);
}

function deleteCategory(id) {
  // 先删除该分类下的所有图片记录（不删除存储源文件）
  db.prepare('DELETE FROM images WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

/**
 * 获取仪表盘统计数据
 */
function getStats() {
  const storageCount = db.prepare('SELECT COUNT(*) as count FROM storage_configs').get().count;
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  const imageCount = db.prepare('SELECT COUNT(*) as count FROM images').get().count;
  const totalSize = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM images').get().total;

  return { storageCount, categoryCount, imageCount, totalSize };
}

/**
 * 获取所有图片（用于数据浏览）
 */
function getAllImages(page = 1, size = 50) {
  const offset = (page - 1) * size;
  const total = db.prepare('SELECT COUNT(*) as count FROM images').get().count;
  const items = db.prepare(`
    SELECT i.*, c.name as category_name, c.slug as category_slug
    FROM images i
    LEFT JOIN categories c ON i.category_id = c.id
    ORDER BY i.id DESC LIMIT ? OFFSET ?
  `).all(size, offset);

  return { items, total, page, size, pages: Math.ceil(total / size) };
}

module.exports = {
  getRandomImage,
  getCategoryBySlug,
  uploadImage,
  deleteImage,
  deleteImages,
  syncFromStorage,
  getImages,
  getStorages,
  getStorageById,
  createStorage,
  updateStorage,
  deleteStorage,
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getStats,
  getAllImages,
};
