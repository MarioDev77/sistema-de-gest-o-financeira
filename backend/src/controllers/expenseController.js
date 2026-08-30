const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');

const CATEGORIES = ['aluguel','energia','agua','internet','funcionarios','fornecedores','transporte','marketing','embalagens','impostos','manutencao','outros'];
const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'outros'];

async function refreshOverdueExpenses() {
  await query(
    `UPDATE expenses SET status = 'vencido'
     WHERE due_date < CURRENT_DATE AND status = 'pendente' AND deleted_at IS NULL`
  );
}

async function listExpenses(req, res, next) {
  try {
    await refreshOverdueExpenses();
    const { from, to, category, status } = req.query;
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    if (from) { params.push(from); conditions.push(`expense_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`expense_date <= $${params.length}`); }
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }

    const { rows } = await query(
      `SELECT * FROM expenses WHERE ${conditions.join(' AND ')} ORDER BY expense_date DESC LIMIT 500`,
      params
    );
    res.json({ expenses: rows });
  } catch (err) {
    next(err);
  }
}

function validateExpenseInput(body) {
  const errors = [];
  if (!body.description || !body.description.trim()) errors.push('Descrição é obrigatória.');
  if (!CATEGORIES.includes(body.category)) errors.push('Categoria inválida.');
  if (body.amount === undefined || Number(body.amount) < 0) errors.push('Valor inválido.');
  if (!body.expenseDate) errors.push('Data da despesa é obrigatória.');
  return errors;
}

async function createExpense(req, res, next) {
  try {
    const errors = validateExpenseInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { description, category, amount, expenseDate, dueDate, paymentMethod, receiptUrl, notes, status } = req.body;

    const { rows } = await query(
      `INSERT INTO expenses (description, category, amount, expense_date, due_date, payment_method, receipt_url, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'pendente'),$10) RETURNING *`,
      [description.trim(), category, amount, expenseDate, dueDate || null, paymentMethod || null, receiptUrl || null, notes || null, status || null, req.user.id]
    );

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'expenses', recordId: rows[0].id, newData: rows[0], req });
    res.status(201).json({ expense: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const errors = validateExpenseInput(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { rows: beforeRows } = await query('SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (beforeRows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada.' });

    const { description, category, amount, expenseDate, dueDate, paymentMethod, receiptUrl, notes } = req.body;
    const { rows } = await query(
      `UPDATE expenses SET description=$1, category=$2, amount=$3, expense_date=$4, due_date=$5,
        payment_method=$6, receipt_url=$7, notes=$8 WHERE id=$9 RETURNING *`,
      [description.trim(), category, amount, expenseDate, dueDate || null, paymentMethod || null, receiptUrl || null, notes || null, id]
    );

    await logAudit({ userId: req.user.id, action: 'update', tableName: 'expenses', recordId: id, oldData: beforeRows[0], newData: rows[0], req });
    res.json({ expense: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Marcar como paga é o que efetivamente gera a saída no fluxo de caixa —
// uma despesa "pendente" ainda não afetou o caixa.
async function markExpensePaid(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { paymentMethod } = req.body;
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        "SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
        [id]
      );
      if (rows.length === 0) {
        const err = new Error('Despesa não encontrada.');
        err.status = 404;
        throw err;
      }
      if (rows[0].status === 'pago') {
        const err = new Error('Despesa já está paga.');
        err.status = 400;
        throw err;
      }

      const { rows: updated } = await client.query(
        "UPDATE expenses SET status = 'pago', payment_method = $1 WHERE id = $2 RETURNING *",
        [paymentMethod, id]
      );
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('saida','despesa',$1,$2,'expense',$3,$4)`,
        [updated[0].amount, updated[0].description, id, req.user.id]
      );
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'pay', tableName: 'expenses', recordId: id, newData: result, req });
    res.json({ expense: result });
  } catch (err) {
    next(err);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      'UPDATE expenses SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [req.user.id, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada.' });
    await logAudit({ userId: req.user.id, action: 'delete', tableName: 'expenses', recordId: id, oldData: rows[0], req });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listExpenses, createExpense, updateExpense, markExpensePaid, deleteExpense };
