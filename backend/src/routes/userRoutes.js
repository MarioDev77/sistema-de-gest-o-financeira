const express = require('express');
const { listUsers, createUser, deactivateUser } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middlewares/auth');

const router = express.Router();

// Toda esta rota exige estar autenticado E ser admin —
// funcionário não gerencia usuários.
router.use(authenticate, requireRole('admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/deactivate', deactivateUser);

module.exports = router;
