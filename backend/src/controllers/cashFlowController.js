const { query } = require('../config/db');

async function listCashMovements(req, res, next) {
  try {
    const { from, to, direction, category } = req.query;
    const conditions = [];
    const params = [];
    if (from) { params.push(from); conditions.push(`movement_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`movement_date <= $${params.length}`); }
    if (direction) { params.push(direction); conditions.push(`direction = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM cash_movements ${where} ORDER BY movement_date DESC LIMIT 500`,
      params
    );

    const { rows: totals } = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE direction = 'entrada'), 0) AS total_in,
         COALESCE(SUM(amount) FILTER (WHERE direction = 'saida'), 0) AS total_out
       FROM cash_movements ${where}`,
      params
    );

    const totalIn = Number(totals[0].total_in);
    const totalOut = Number(totals[0].total_out);

    res.json({
      movements: rows,
      summary: { totalIn, totalOut, balance: totalIn - totalOut },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCashMovements };
