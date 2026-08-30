const express = require('express');
const { listProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate);

// Funcionário pode consultar produtos, mas não cadastrar/alterar custo ou excluir
// (regra explícita: "funcionário não pode alterar custos").
router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', requireRole('admin'), createProduct);
router.put('/:id', requireRole('admin'), updateProduct);
router.delete('/:id', requireRole('admin'), deleteProduct);

module.exports = router;
