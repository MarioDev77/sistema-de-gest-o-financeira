const { query } = require('../config/db');

async function getDashboard(req, res, next) {
  try {
    const { rows: dayRows } = await query(
      `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
       FROM sales WHERE status = 'concluida' AND deleted_at IS NULL AND sale_date::date = CURRENT_DATE`
    );
    const { rows: monthRows } = await query(
      `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count, COALESCE(SUM(profit),0) AS profit,
              COALESCE(SUM(total_cost),0) AS cost
       FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
       AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)`
    );
    const { rows: saleTypeRows } = await query(
      `SELECT sale_type, COALESCE(SUM(total),0) AS total
       FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
       AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)
       GROUP BY sale_type`
    );
    const { rows: receivableRows } = await query(
      `SELECT COALESCE(SUM(amount - paid_amount),0) AS pending
       FROM installments WHERE status IN ('pendente','parcial','vencido')`
    );
    const { rows: receivedInstallmentsRows } = await query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM payments
       WHERE installment_id IS NOT NULL
       AND date_trunc('month', payment_date) = date_trunc('month', CURRENT_DATE)`
    );
    const { rows: expenseRows } = await query(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
       WHERE deleted_at IS NULL AND status = 'pago'
       AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)`
    );
    const { rows: overdueExpenseRows } = await query(
      `SELECT COUNT(*) AS count FROM expenses WHERE deleted_at IS NULL AND status = 'vencido'`
    );
    const { rows: stockRows } = await query(
      `SELECT COUNT(*) FILTER (WHERE quantity <= min_stock) AS low_stock,
              COALESCE(SUM(quantity * cost),0) AS stock_cost_value,
              COALESCE(SUM(quantity * price),0) AS stock_sale_value
       FROM products WHERE deleted_at IS NULL AND status = 'ativo'`
    );
    const { rows: dailyRevenueRows } = await query(
      `SELECT sale_date::date AS day, SUM(total) AS total
       FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
       AND sale_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY sale_date::date ORDER BY day`
    );
    const { rows: paymentMethodRows } = await query(
      `SELECT payment_method, COALESCE(SUM(total),0) AS total
       FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
       AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)
       GROUP BY payment_method`
    );

    const monthTotal = Number(monthRows[0].total);
    const monthCost = Number(monthRows[0].cost);
    const monthExpenses = Number(expenseRows[0].total);
    const grossProfit = monthTotal - monthCost;
    const netProfit = grossProfit - monthExpenses;

    const avista = saleTypeRows.find((r) => r.sale_type === 'avista');
    const aprazo = saleTypeRows.find((r) => r.sale_type === 'aprazo');

    res.json({
      revenueToday: Number(dayRows[0].total),
      salesToday: Number(dayRows[0].count),
      revenueMonth: monthTotal,
      salesMonth: Number(monthRows[0].count),
      avistaMonth: avista ? Number(avista.total) : 0,
      aprazoMonth: aprazo ? Number(aprazo.total) : 0,
      receivedInstallmentsMonth: Number(receivedInstallmentsRows[0].total),
      pendingReceivable: Number(receivableRows[0].pending),
      expensesMonth: monthExpenses,
      overdueExpenses: Number(overdueExpenseRows[0].count),
      grossProfitMonth: grossProfit,
      netProfitMonth: netProfit,
      lowStockCount: Number(stockRows[0].low_stock),
      stockCostValue: Number(stockRows[0].stock_cost_value),
      stockSaleValue: Number(stockRows[0].stock_sale_value),
      dailyRevenue: dailyRevenueRows.map((r) => ({ day: r.day, total: Number(r.total) })),
      paymentMethods: paymentMethodRows.map((r) => ({ method: r.payment_method, total: Number(r.total) })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
