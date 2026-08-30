const { query, withTransaction } = require('../config/db');
const { logAudit } = require('../utils/audit');

const PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'outros'];

/**
 * Recibos são recebimentos avulsos: "recebi R$300 de Fulano em tal data",
 * sem precisar estar amarrado a uma parcela de empréstimo. Cada recibo
 * confirmado gera uma entrada de caixa automaticamente.
 */
async function listReceipts(req, res, next) {
  try {
    const { search } = req.query;
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    if (search) { params.push(`%${search}%`); conditions.push(`person_name ILIKE $${params.length}`); }

    const { rows } = await query(
      `SELECT * FROM receipts WHERE ${conditions.join(' AND ')} ORDER BY receipt_date DESC, id DESC`,
      params
    );
    const total = rows
      .filter((r) => r.status !== 'cancelado')
      .reduce((sum, r) => sum + Number(r.amount), 0);

    res.json({ receipts: rows, total });
  } catch (err) {
    next(err);
  }
}

async function createReceipt(req, res, next) {
  try {
    const { personName, amount, receiptDate, paymentMethod, notes } = req.body;

    if (!personName || !personName.trim()) return res.status(400).json({ error: 'Nome da pessoa é obrigatório.' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Valor recebido inválido.' });
    if (!receiptDate) return res.status(400).json({ error: 'Data do recebimento é obrigatória.' });
    if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida.' });
    }

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO receipts (person_name, amount, receipt_date, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [personName.trim(), amount, receiptDate, paymentMethod || null, notes || null, req.user.id]
      );
      const receipt = rows[0];

      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('entrada','recibo_recebido',$1,$2,'receipt',$3,$4)`,
        [amount, `Recebido de ${personName.trim()}`, receipt.id, req.user.id]
      );

      return receipt;
    });

    await logAudit({ userId: req.user.id, action: 'create', tableName: 'receipts', recordId: result.id, newData: result, req });
    res.status(201).json({ receipt: result });
  } catch (err) {
    next(err);
  }
}

async function cancelReceipt(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { rows } = await query('SELECT * FROM receipts WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Recibo não encontrado.' });
    if (rows[0].status === 'cancelado') return res.status(400).json({ error: 'Este recibo já está cancelado.' });

    const result = await withTransaction(async (client) => {
      const { rows: updated } = await client.query(
        "UPDATE receipts SET status = 'cancelado' WHERE id = $1 RETURNING *",
        [id]
      );
      // Estorna a entrada de caixa correspondente.
      await client.query(
        `INSERT INTO cash_movements (direction, category, amount, description, reference_type, reference_id, created_by)
         VALUES ('saida','recibo_cancelado',$1,$2,'receipt',$3,$4)`,
        [rows[0].amount, `Estorno recibo cancelado - ${rows[0].person_name}`, id, req.user.id]
      );
      return updated[0];
    });

    await logAudit({ userId: req.user.id, action: 'cancel', tableName: 'receipts', recordId: id, oldData: rows[0], newData: result, req });
    res.json({ receipt: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { listReceipts, createReceipt, cancelReceipt };
