const express = require('express');
const {
  listDebts, getDebt, createDebt, updateDebt, payDebt, payDebtInstallment, editDebtPayment,
  listInterestPaymentsDebt, listDebtInstallmentsSchedule, updateDebtInstallment, cancelDebt,
} = require('../controllers/debtController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', listDebts);
router.get('/payments/interest', listInterestPaymentsDebt);
router.get('/installments/schedule', listDebtInstallmentsSchedule);
router.get('/:id', getDebt);
router.post('/', createDebt);
router.put('/:id', updateDebt);
router.post('/:id/pay', payDebt);
router.put('/payments/:id', editDebtPayment);
router.put('/installments/:id', updateDebtInstallment);
router.post('/installments/:id/pay', payDebtInstallment);
router.post('/:id/cancel', cancelDebt);

module.exports = router;
