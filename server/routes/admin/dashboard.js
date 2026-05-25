const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const imageService = require('../../services/imageService');

router.use(auth);

/**
 * GET /admin/api/stats
 * 仪表盘统计数据
 */
router.get('/', (req, res) => {
  try {
    const stats = imageService.getStats();
    res.json({ code: 0, data: stats });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

module.exports = router;
