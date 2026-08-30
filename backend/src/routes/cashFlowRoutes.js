const express = require('express');
const { listCashMovements } = require('../controllers/cashFlowController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', listCashMovements);

module.exports = router;
