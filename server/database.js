const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// 确保数据目录存在
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db = null;

/**
 * sql.js 兼容层，模拟 better-sqlite3 的 API
 */
class DatabaseWrapper {
  constructor(sqliteDb) {
    this._db = sqliteDb;
  }

  exec(sql) {
    this._db.run(sql);
  }

  pragma(str) {
    try { this._db.run(`PRAGMA ${str}`); } catch {}
  }

  prepare(sql) {
    const db = this._db;
    return {
      get(...params) {
        const stmt = db.prepare(sql);
        if (params.length) stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = db.prepare(sql);
        if (params.length) stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      run(...params) {
        const stmt = db.prepare(sql);
        if (params.length) stmt.bind(params);
        stmt.step();
        stmt.free();
        const changes = db.getRowsModified();
        const lastId = db.exec("SELECT last_insert_rowid()");
        return {
          changes,
          lastInsertRowid: lastId[0]?.values[0]?.[0] ?? 0,
        };
      },
    };
  }

  /**
   * 事务支持
   */
  transaction(fn) {
    this._db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this._db.run('COMMIT');
      return result;
    } catch (err) {
      this._db.run('ROLLBACK');
      throw err;
    }
  }

  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  }
}

/**
 * 初始化数据库
 */
async function initDatabase() {
  const SQL = await initSqlJs();

  let sqliteDb;
  if (fs.existsSync(config.dbPath)) {
    const fileBuffer = fs.readFileSync(config.dbPath);
    sqliteDb = new SQL.Database(fileBuffer);
  } else {
    sqliteDb = new SQL.Database();
  }

  _db = new DatabaseWrapper(sqliteDb);
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS storage_configs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      config      TEXT NOT NULL,
      endpoint    TEXT,
      status      INTEGER DEFAULT 1,
      created_at  DATETIME DEFAULT (datetime('now','localtime')),
      updated_at  DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      slug            TEXT NOT NULL UNIQUE,
      description     TEXT,
      storage_id      INTEGER NOT NULL,
      storage_path    TEXT NOT NULL,
      status          INTEGER DEFAULT 1,
      cache_ttl       INTEGER DEFAULT 300,
      created_at      DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (storage_id) REFERENCES storage_configs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id     INTEGER NOT NULL,
      filename        TEXT NOT NULL,
      storage_key     TEXT NOT NULL,
      url             TEXT NOT NULL,
      size            INTEGER DEFAULT 0,
      width           INTEGER DEFAULT 0,
      height          INTEGER DEFAULT 0,
      mime_type       TEXT,
      created_at      DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_images_category ON images(category_id);
  `);

  return _db;
}

function getDb() {
  if (!_db) throw new Error('Database not initialized');
  return _db;
}

let _autoSaveTimer = null;

function startAutoSave() {
  // 清除旧定时器（如果有的话）
  if (_autoSaveTimer) {
    clearInterval(_autoSaveTimer);
  }
  const interval = config.autoSaveInterval * 1000;
  _autoSaveTimer = setInterval(() => {
    if (_db) {
      try { _db.save(); } catch (e) { console.error('[DB Save Error]', e.message); }
    }
  }, interval);
  console.log(`[DB] 自动保存已启动，间隔 ${config.autoSaveInterval} 秒`);
}

function stopAutoSave() {
  if (_autoSaveTimer) {
    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;
  }
}

module.exports = { initDatabase, getDb, startAutoSave, stopAutoSave };
