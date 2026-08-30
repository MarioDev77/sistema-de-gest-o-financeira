const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

async function listCustomers(req, res, next) {
  try {
    const { search } = req.query;
    const params = [];
    let where = 'WHERE deleted_at IS NULL';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $${params.length} OR document ILIKE $${params.length})`;
    }
    const { rows } = await query(
      `SELECT id, name, document, phone, whatsapp, email, address, notes, created_at
       FROM customers ${where} ORDER BY name`,
      params
    );
    res.json({ customers: rows });
  } catch (err) {
    next(err);
  }
}

// Histórico do cliente: compras, valores pagos/pendentes — usado na tela de detalhe.
async function getCustomerHistory(req, res, next) {
  try {
    const id = Number(req.params.id);

    const { rows: customerRows } = await query(
      'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (customerRows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const { rows: sales } = await query(
      `SELECT id, sale_number, sale_date, sale_type, total, status
       FROM sales WHERE customer_id = $1 AND deleted_at IS NULL ORDER BY sale_date DESC`,
      [id]
    );

    const { rows: pendingInstallments } = await query(
      `SELECT i.id, i.due_date, i.amount, i.paid_amount, i.status, s.sale_number
       FROM installments i
       JOIN sales s ON s.id = i.sale_id
       WHERE s.customer_id = $1 AND s.deleted_at IS NULL AND i.status IN ('pendente','parcial','vencido')
       ORDER BY i.due_date`,
      [id]
    );

    const totalPurchased = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalPending = pendingInstallments.reduce(
      (sum, i) => sum + (Number(i.amount) - Number(i.paid_amount)),
      0
    );

    res.json({
      customer: customerRows[0],
      sales,
      pendingInstallments,
      totals: { totalPurchased, totalPending },
    });
  } catch (err) {
    next(err);
  }
}

function validateCustomerInput(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('Nome é obrigatório.');
  return errors;
}

async function createCustomer(req, res, next) {
  try {
    const errors = validateCustomerInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { name, document, phone, whatsapp, email, address, notes } = req.body;
    const { rows } = await query(
      `INSERT INTO customers (name, document, phone, whatsapp, email, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name.trim(), document || null, phone || null, whatsapp || null, email || null, address || null, notes || null]
    );

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'customers', recordId: rows[0].id, newData: rows[0], req });
    res.status(201).json({ customer: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const id = Number(req.params.id);
    const errors = validateCustomerInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { rows: beforeRows } = await query('SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (beforeRows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });

    const { name, document, phone, whatsapp, email, address, notes } = req.body;
    const { rows } = await query(
      `UPDATE customers SET name=$1, document=$2, phone=$3, whatsapp=$4, email=$5, address=$6, notes=$7
       WHERE id=$8 RETURNING *`,
      [name.trim(), document || null, phone || null, whatsapp || null, email || null, address || null, notes || null, id]
    );

    await logAudit({ userId: req.user.id, action: 'update', tableName: 'customers', recordId: id, oldData: beforeRows[0], newData: rows[0], req });
    res.json({ customer: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      'UPDATE customers SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [req.user.id, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado.' });
    await logAudit({ userId: req.user.id, action: 'delete', tableName: 'customers', recordId: id, oldData: rows[0], req });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCustomers, getCustomerHistory, createCustomer, updateCustomer, deleteCustomer };
