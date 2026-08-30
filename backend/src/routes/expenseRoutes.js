const express = require('express');
const {
  listExpenses, createExpense, updateExpense, markExpensePaid, deleteExpense,
} = require('../controllers/expenseController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
// Despesas são dado financeiro sensível — o escopo só concede a funcionário
// vendas, consulta de produtos e cadastro de clientes; despesas ficam com admin.
router.use(authenticate, requireRole('admin'));

router.get('/', listExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.post('/:id/pay', markExpensePaid);
router.delete('/:id', deleteExpense);

module.exports = router;
