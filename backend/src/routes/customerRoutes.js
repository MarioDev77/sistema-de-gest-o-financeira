const express = require('express');
const {
  listCustomers, getCustomerHistory, createCustomer, updateCustomer, deleteCustomer,
} = require('../controllers/customerController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate);

// Funcionário pode cadastrar e consultar clientes (regra explícita do escopo).
router.get('/', listCustomers);
router.get('/:id/history', getCustomerHistory);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', requireRole('admin'), deleteCustomer);

module.exports = router;
