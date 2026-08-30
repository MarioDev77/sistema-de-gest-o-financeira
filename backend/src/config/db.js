const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL não definida. Configure o arquivo .env (veja .env.example).'
  );
}

// No Railway, em produção, normalmente é necessário SSL.
// Em desenvolvimento local isso costuma vir desligado.
const useSSL = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Erro em um cliente ocioso do pool — não deve derrubar o processo,
  // mas precisa ficar visível no log.
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

/**
 * Executa uma query usando o pool de conexões.
 * Uso: const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Executa uma função dentro de uma transação (BEGIN/COMMIT/ROLLBACK).
 * Uso: await withTransaction(async (client) => { ... client.query(...) ... });
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
