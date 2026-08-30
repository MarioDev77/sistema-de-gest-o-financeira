const express = require('express');
const { listReceipts, createReceipt, updateReceipt, cancelReceipt } = require('../controllers/receiptController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
// Recebimentos avulsos envolvem dinheiro entrando no caixa da loja —
// restrito a admin, alinhado com o módulo de Empréstimos.
router.use(authenticate, requireRole('admin'));

router.get('/', listReceipts);
router.post('/', createReceipt);
router.put('/:id', updateReceipt);
router.post('/:id/cancel', cancelReceipt);

module.exports = router;
