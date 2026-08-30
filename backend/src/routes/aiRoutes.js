const express = require('express');
const { getAiAnalysis } = require('../controllers/aiController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));
router.get('/analysis', getAiAnalysis);

module.exports = router;
