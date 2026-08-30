const express = require('express');
const { listMovements, createMovement } = require('../controllers/stockController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', listMovements);
// Movimentação manual (compra/perda/ajuste/devolução) é restrita a admin —
// funcionário só mexe em estoque indiretamente, registrando vendas.
router.post('/', requireRole('admin'), createMovement);

module.exports = router;
