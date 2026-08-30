const { query } = require('../config/db');
const { logAudit } = require('../utils/audit');

async function listMonthlyClosings(req, res, next) {
  try {
    const { rows } = await query('SELECT * FROM monthly_closings ORDER BY year DESC, month DESC');
    res.json({ closings: rows });
  } catch (err) {
    next(err);
  }
}

// Fecha o mês: calcula os totais e grava um snapshot em monthly_closings.
// Nunca apaga dados históricos — só registra o resumo consolidado do período.
async function closeMonth(req, res, next) {
  try {
    const { year, month } = req.body;
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Informe ano e mês (1-12) válidos.' });
    }

    const { rows: existing } = await query(
      'SELECT id FROM monthly_closings WHERE year = $1 AND month = $2',
      [year, month]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este mês já foi fechado anteriormente.' });
    }

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const { rows: salesRows } = await query(
      `SELECT COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(total_cost),0) AS costs
       FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
       AND date_trunc('month', sale_date) = $1::date`,
      [monthStart]
    );
    const { rows: expenseRows } = await query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
       WHERE deleted_at IS NULL AND status = 'pago' AND date_trunc('month', expense_date) = $1::date`,
      [monthStart]
    );
    const { rows: cashRows } = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE category = 'emprestimo_concedido'), 0) AS loaned,
         COALESCE(SUM(amount) FILTER (WHERE category IN ('recebimento_emprestimo','juros_emprestimo')), 0) AS received
       FROM cash_movements WHERE date_trunc('month', movement_date) = $1::date`,
      [monthStart]
    );

    const revenue = Number(salesRows[0].revenue);
    const costs = Number(salesRows[0].costs);
    const expensesTotal = Number(expenseRows[0].total);
    const grossProfit = revenue - costs;
    const netProfit = grossProfit - expensesTotal;

    const { rows } = await query(
      `INSERT INTO monthly_closings
        (year, month, revenue, costs, expenses, gross_profit, net_profit, loaned_amount, received_loan_amount, closed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [year, month, revenue, costs, expensesTotal, grossProfit, netProfit,
       Number(cashRows[0].loaned), Number(cashRows[0].received), req.user.id]
    );

    await logAudit({ userId: req.user.id, action: 'close', tableName: 'monthly_closings', recordId: rows[0].id, newData: rows[0], req });
    res.status(201).json({ closing: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMonthlyClosings, closeMonth };
