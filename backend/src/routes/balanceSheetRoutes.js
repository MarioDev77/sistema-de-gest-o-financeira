const express = require('express');
const { getBalanceSheet } = require('../controllers/balanceSheetController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));
router.get('/', getBalanceSheet);

module.exports = router;
