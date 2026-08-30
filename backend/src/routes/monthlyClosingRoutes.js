const express = require('express');
const { listMonthlyClosings, closeMonth } = require('../controllers/monthlyClosingController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', listMonthlyClosings);
router.post('/', closeMonth);

module.exports = router;
