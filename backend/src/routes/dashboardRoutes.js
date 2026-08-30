const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', getDashboard);

module.exports = router;
