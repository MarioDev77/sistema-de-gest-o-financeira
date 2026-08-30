const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password || !isValidEmail(email)) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.active, u.deleted_at,
              r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];

    // Mensagem de erro idêntica para "não existe" e "senha errada" —
    // não dar dica pra quem está tentando adivinhar e-mails cadastrados.
    const invalidCredentials = () =>
      res.status(401).json({ error: 'E-mail ou senha inválidos.' });

    if (!user || !user.active || user.deleted_at) {
      return invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return invalidCredentials();
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  // req.user já vem populado e revalidado pelo middleware "authenticate"
  res.json({ user: req.user });
}

module.exports = { login, me };
