const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');

const MANUAL_REASONS = ['compra', 'devolucao', 'perda', 'ajuste'];

async function listMovements(req, res, next) {
  try {
    const { productId } = req.query;
    const conditions = [];
    const params = [];
    if (productId) {
      params.push(Number(productId));
      conditions.push(`m.product_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT m.*, p.name AS product_name
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       ${where}
       ORDER BY m.created_at DESC
       LIMIT 200`,
      params
    );
    res.json({ movements: rows });
  } catch (err) {
    next(err);
  }
}

// Movimentação manual (não vinculada a uma venda). Vendas geram sua própria
// movimentação de saída (reason='venda') dentro da transação de criação da venda.
async function createMovement(req, res, next) {
  try {
    const { productId, direction, reason, quantity, notes } = req.body;

    if (!productId || !direction || !reason || !quantity) {
      return res.status(400).json({ error: 'Produto, direção, motivo e quantidade são obrigatórios.' });
    }
    if (!['entrada', 'saida'].includes(direction)) {
      return res.status(400).json({ error: 'Direção inválida.' });
    }
    if (!MANUAL_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Motivo inválido para movimentação manual.' });
    }
    if (Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero.' });
    }

    const result = await withTransaction(async (client) => {
      const { rows: productRows } = await client.query(
        'SELECT id, quantity FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [productId]
      );
      if (productRows.length === 0) {
        const err = new Error('Produto não encontrado.');
        err.status = 404;
        throw err;
      }

      const current = productRows[0].quantity;
      const delta = direction === 'entrada' ? Number(quantity) : -Number(quantity);
      const newQuantity = current + delta;

      if (newQuantity < 0) {
        const err = new Error('Estoque insuficiente para esta saída.');
        err.status = 400;
        throw err;
      }

      await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [newQuantity, productId]);

      const { rows: movementRows } = await client.query(
        `INSERT INTO stock_movements (product_id, direction, reason, quantity, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [productId, direction, reason, quantity, notes || null, req.user.id]
      );

      return movementRows[0];
    });

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'stock_movements', recordId: result.id, newData: result, req });
    res.status(201).json({ movement: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMovements, createMovement };
