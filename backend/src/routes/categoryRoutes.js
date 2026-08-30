const express = require('express');
const { listCategories, createCategory, deleteCategory } = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', listCategories);
router.post('/', requireRole('admin'), createCategory);
router.delete('/:id', requireRole('admin'), deleteCategory);

module.exports = router;
