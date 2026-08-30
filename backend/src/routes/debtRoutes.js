const express = require('express');
const {
  listDebts, getDebt, createDebt, updateDebt, payDebt, updateDebtInstallment, cancelDebt,
} = require('../controllers/debtController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', listDebts);
router.get('/:id', getDebt);
router.post('/', createDebt);
router.put('/:id', updateDebt);
router.post('/:id/pay', payDebt);
router.put('/installments/:id', updateDebtInstallment);
router.post('/:id/cancel', cancelDebt);

module.exports = router;
