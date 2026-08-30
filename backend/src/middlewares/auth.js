const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * Exige um JWT válido no header Authorization: Bearer <token>.
 * Também revalida no banco que o usuário ainda existe, está ativo e não foi
 * excluído — assim, revogar/desativar um usuário tem efeito imediato mesmo
 * que o token ainda não tenha expirado.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Token não informado.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.active, u.deleted_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [payload.sub]
    );

    const user = rows[0];
    if (!user || !user.active || user.deleted_at) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo.' });
    }

    // Nunca confiar apenas no que veio no token para autorização —
    // o papel (role) é sempre conferido contra o banco, não contra o payload.
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Exige que o usuário autenticado possua um dos papéis informados.
 * Uso: router.delete('/produtos/:id', authenticate, requireRole('admin'), ...)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
