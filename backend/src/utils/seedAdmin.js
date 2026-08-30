/**
 * Cria o primeiro usuário administrador, usando os dados do .env
 * (SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD).
 * Rode uma única vez: npm run seed:admin
 * Não faz nada se já existir um usuário com esse e-mail.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');

async function seedAdmin() {
  const name = process.env.SEED_ADMIN_NAME;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'Defina SEED_ADMIN_NAME, SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env antes de rodar este script.'
    );
  }
  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD deve ter no mínimo 8 caracteres.');
  }

  const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [
    email.toLowerCase().trim(),
  ]);
  if (existing.length > 0) {
    console.log(`Usuário ${email} já existe. Nada a fazer.`);
    return;
  }

  const { rows: roleRows } = await query("SELECT id FROM roles WHERE name = 'admin'");
  if (roleRows.length === 0) {
    throw new Error('Role "admin" não encontrada. Rode as migrations primeiro (npm run migrate).');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)`,
    [name.trim(), email.toLowerCase().trim(), passwordHash, roleRows[0].id]
  );

  console.log(`Administrador ${email} criado com sucesso.`);
  console.log('Troque a senha padrão assim que fizer o primeiro login.');
}

seedAdmin()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
