const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { getDb } = require('../../database');
const db = new Proxy({}, { get(_, prop) { return getDb()[prop]; } });

router.use(auth);

// 允许操作的表（白名单，防止SQL注入）
const ALLOWED_TABLES = ['storage_configs', 'categories', 'images'];

/**
 * GET /admin/api/db/tables
 * 获取所有表信息
 */
router.get('/tables', (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).all();

    const result = tables.map(t => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
      const columns = db.prepare(`PRAGMA table_info("${t.name}")`).all();
      return {
        name: t.name,
        count,
        columns: columns.map(c => ({
          name: c.name,
          type: c.type,
          notnull: !!c.notnull,
          pk: !!c.pk,
          default: c.dflt_value,
        })),
      };
    });

    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * GET /admin/api/db/:table
 * 查询表数据（分页）
 */
router.get('/:table', (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ code: 400, message: '不允许访问该表' });
    }

    const { page = 1, size = 50, sort, order = 'DESC', search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(size);

    // 获取列信息
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
    const columnNames = columns.map(c => c.name);

    // 构建查询
    let whereClause = '';
    let countParams = [];
    let queryParams = [];

    if (search && columnNames.length > 0) {
      // 在所有TEXT列中搜索
      const textColumns = columns.filter(c => c.type === 'TEXT' || c.type === 'TEXT').map(c => c.name);
      if (textColumns.length > 0) {
        const conditions = textColumns.map(c => `"${c}" LIKE ?`);
        whereClause = ` WHERE ${conditions.join(' OR ')}`;
        const searchParam = `%${search}%`;
        countParams = textColumns.map(() => searchParam);
        queryParams = [...countParams];
      }
    }

    // 排序
    let orderClause = ' ORDER BY id DESC';
    if (sort && columnNames.includes(sort)) {
      const orderDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderClause = ` ORDER BY "${sort}" ${orderDir}`;
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM "${table}"${whereClause}`).get(...countParams).count;

    queryParams.push(parseInt(size), offset);
    const items = db.prepare(
      `SELECT * FROM "${table}"${whereClause}${orderClause} LIMIT ? OFFSET ?`
    ).all(...queryParams);

    res.json({
      code: 0,
      data: {
        items,
        total,
        page: parseInt(page),
        size: parseInt(size),
        pages: Math.ceil(total / parseInt(size)),
        columns: columnNames,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * PUT /admin/api/db/:table/:id
 * 更新记录
 */
router.put('/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ code: 400, message: '不允许操作该表' });
    }

    const data = req.body;
    // 移除不允许更新的字段
    delete data.id;
    delete data.created_at;

    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }

    const setClause = fields.map(f => `"${f}" = ?`).join(', ');
    db.prepare(`UPDATE "${table}" SET ${setClause} WHERE id = ?`).run(...values, id);

    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * DELETE /admin/api/db/:table/:id
 * 删除记录
 */
router.delete('/:table/:id', (req, res) => {
  try {
    const { table, id } = req.params;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ code: 400, message: '不允许操作该表' });
    }

    db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/api/db/query
 * 执行自定义查询（只读，仅SELECT）
 */
router.post('/query', (req, res) => {
  try {
    const { sql: sqlText } = req.body;
    if (!sqlText) return res.status(400).json({ code: 400, message: '缺少sql参数' });

    // 安全检查：只允许SELECT
    const trimmed = sqlText.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA')) {
      return res.status(400).json({ code: 400, message: '只允许SELECT和PRAGMA查询' });
    }

    const result = db.prepare(sqlText).all();
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message });
  }
});

module.exports = router;
