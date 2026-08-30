const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const ALLOWED_ROLES = ['admin', 'funcionario'];

// Apenas administrador acessa este controller (garantido pela rota).
// Ainda assim, cada função revalida a role recebida para não aceitar
// valores fora do esperado.

async function listUsers(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.active, r.name AS role, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.deleted_at IS NULL
       ORDER BY u.name`
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Nome, e-mail, senha e papel são obrigatórios.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres.' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Papel inválido.' });
    }

    const { rows: roleRows } = await query('SELECT id FROM roles WHERE name = $1', [role]);
    if (roleRows.length === 0) {
      return res.status(400).json({ error: 'Papel inválido.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, active, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, roleRows[0].id]
    );

    res.status(201).json({ user: { ...rows[0], role } });
  } catch (err) {
    next(err);
  }
}

async function deactivateUser(req, res, next) {
  try {
    const targetId = Number(req.params.id);

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });
    }

    const { rows } = await query(
      `UPDATE users SET active = FALSE
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [targetId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, deactivateUser };
