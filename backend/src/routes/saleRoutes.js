const express = require('express');
const { listSales, getSale, createSale, payInstallment, cancelSale } = require('../controllers/saleController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', listSales);
router.get('/:id', getSale);
router.post('/', createSale);
router.post('/installments/:id/pay', payInstallment);
// Cancelar venda reverte estoque e é uma operação sensível — só admin.
router.post('/:id/cancel', requireRole('admin'), cancelSale);

module.exports = router;
