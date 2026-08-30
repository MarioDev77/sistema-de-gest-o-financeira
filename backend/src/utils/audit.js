const { query } = require('../config/db');

/**
 * Registra uma entrada de auditoria. Nunca lança erro para não derrubar a
 * operação principal por causa de um problema no log — apenas avisa no console.
 */
async function logAudit({ userId, action, tableName, recordId, oldData, newData, req }) {
  try {
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        action,
        tableName,
        recordId || null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ip,
      ]
    );
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err);
  }
}

module.exports = { logAudit };
