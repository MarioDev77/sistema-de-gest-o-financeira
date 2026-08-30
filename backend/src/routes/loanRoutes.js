const express = require('express');
const {
  listLoans, getLoan, createLoan, updateLoan, payLoanInstallment,
  receiveLoanPayment, listInterestPayments, cancelLoan,
} = require('../controllers/loanController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
// Empréstimos envolvem dinheiro saindo do caixa da loja — restrito a admin,
// alinhado com "funcionário não pode excluir empréstimos / alterar registros
// financeiros sem permissão".
router.use(authenticate, requireRole('admin'));

router.get('/', listLoans);
router.get('/payments/interest', listInterestPayments);
router.get('/:id', getLoan);
router.post('/', createLoan);
router.put('/:id', updateLoan);
router.post('/:id/receive', receiveLoanPayment);
router.post('/installments/:id/pay', payLoanInstallment);
router.post('/:id/cancel', cancelLoan);

module.exports = router;
