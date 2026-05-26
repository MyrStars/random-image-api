const express = require('express');
const multer = require('multer');
const router = express.Router();
const auth = require('../../middleware/auth');
const imageService = require('../../services/imageService');
const { isImage } = require('../../utils/imageInfo');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // 后端验证文件类型：只允许图片
    if (isImage(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.originalname}`));
    }
  },
});

router.use(auth);

/**
 * GET /admin/api/images
 * 获取图片列表（分页）
 */
router.get('/', (req, res) => {
  try {
    const { category_id, page = 1, size = 20 } = req.query;
    let result;
    if (category_id) {
      result = imageService.getImages(parseInt(category_id), parseInt(page), parseInt(size));
    } else {
      result = imageService.getAllImages(parseInt(page), parseInt(size));
    }
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/api/images
 * 上传图片
 */
router.post('/', upload.array('files', 20), async (req, res) => {
  try {
    const { category_id } = req.body;
    if (!category_id) return res.status(400).json({ code: 400, message: '缺少category_id' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ code: 400, message: '没有上传文件' });

    const results = [];
    for (const file of req.files) {
      try {
        const image = await imageService.uploadImage(parseInt(category_id), file.buffer, file.originalname);
        results.push({ success: true, image });
      } catch (err) {
        results.push({ success: false, filename: file.originalname, error: err.message });
      }
    }

    res.json({ code: 0, data: results, message: `上传完成，成功${results.filter(r => r.success).length}张，失败${results.filter(r => !r.success).length}张` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * DELETE /admin/api/images/:id
 * 删除单张图片
 */
router.delete('/:id', async (req, res) => {
  try {
    await imageService.deleteImage(parseInt(req.params.id));
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/api/images/batch-delete
 * 批量删除图片
 */
router.post('/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ code: 400, message: '缺少ids' });
    const result = await imageService.deleteImages(ids);
    res.json({ code: 0, data: result, message: `成功${result.success}张，失败${result.failed}张` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

/**
 * POST /admin/api/images/sync
 * 从存储源同步图片
 */
router.post('/sync', async (req, res) => {
  try {
    const { category_id } = req.body;
    if (!category_id) return res.status(400).json({ code: 400, message: '缺少category_id' });
    const result = await imageService.syncFromStorage(parseInt(category_id));
    res.json({ code: 0, data: result, message: `同步完成，新增${result.added}张，共${result.total}张` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

module.exports = router;
