const { query } = require('../config/db');

// Períodos aceitos pelo seletor do gráfico de desempenho. Qualquer valor fora
// desta lista cai no default (14 dias) — nunca confiamos em `days` cru vindo
// da query string dentro de um INTERVAL dinâmico.
const ALLOWED_PERIODS = [7, 14, 30, 90, 180, 365];

/**
 * Endpoint principal do Dashboard.
 *
 * Mantém todos os campos que já existiam (revenueToday, salesToday, ...
 * paymentMethods) para não quebrar nenhum consumidor atual da API, e
 * acrescenta os blocos novos pedidos para a reestruturação visual:
 * comparativo com o mês anterior, fluxo de caixa, vendas recentes, próximos
 * recebimentos, carteira de empréstimos e estoque em atenção.
 *
 * Query params:
 *   ?days=7|14|30|90|180|365 — período do gráfico de desempenho (default 14).
 */
async function getDashboard(req, res, next) {
  try {
    const requestedDays = Number(req.query.days);
    const days = ALLOWED_PERIODS.includes(requestedDays) ? requestedDays : 14;

    const [
      dayRows,
      monthRows,
      prevMonthRows,
      saleTypeRows,
      receivableRows,
      receivedInstallmentsRows,
      expenseRows,
      prevExpenseRows,
      overdueExpenseRows,
      stockRows,
      chartRows,
      paymentMethodRows,
      cashFlowMonthRows,
      cashFlowTotalRows,
      recentSalesRows,
      upcomingReceivablesRows,
      loanPortfolioRows,
      lowStockRows,
    ] = await Promise.all([
      // Faturamento de hoje
      query(
        `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count
         FROM sales WHERE status = 'concluida' AND deleted_at IS NULL AND sale_date::date = CURRENT_DATE`
      ),
      // Faturamento do mês corrente
      query(
        `SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count, COALESCE(SUM(profit),0) AS profit,
                COALESCE(SUM(total_cost),0) AS cost
         FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
         AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)`
      ),
      // Faturamento do mês anterior (base do comparativo "vs. mês anterior")
      query(
        `SELECT COALESCE(SUM(total),0) AS total, COALESCE(SUM(total_cost),0) AS cost
         FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
         AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`
      ),
      query(
        `SELECT sale_type, COALESCE(SUM(total),0) AS total
         FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
         AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)
         GROUP BY sale_type`
      ),
      query(
        `SELECT COALESCE(SUM(amount - paid_amount),0) AS pending
         FROM installments WHERE status IN ('pendente','parcial','vencido')`
      ),
      query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payments
         WHERE installment_id IS NOT NULL
         AND date_trunc('month', payment_date) = date_trunc('month', CURRENT_DATE)`
      ),
      query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
         WHERE deleted_at IS NULL AND status = 'pago'
         AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE)`
      ),
      // Despesas pagas do mês anterior (base do comparativo de lucro líquido)
      query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
         WHERE deleted_at IS NULL AND status = 'pago'
         AND date_trunc('month', expense_date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')`
      ),
      query(
        `SELECT COUNT(*) AS count FROM expenses WHERE deleted_at IS NULL AND status = 'vencido'`
      ),
      query(
        `SELECT COUNT(*) FILTER (WHERE quantity <= min_stock) AS low_stock,
                COALESCE(SUM(quantity * cost),0) AS stock_cost_value,
                COALESCE(SUM(quantity * price),0) AS stock_sale_value
         FROM products WHERE deleted_at IS NULL AND status = 'ativo'`
      ),
      // Série do gráfico de desempenho: receita, custo, despesas pagas e
      // lucro por dia, no período selecionado. generate_series garante que
      // dias sem venda apareçam com 0 em vez de simplesmente sumir do gráfico.
      query(
        `WITH days AS (
           SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS day
         ),
         rev AS (
           SELECT sale_date::date AS day, SUM(total) AS revenue, SUM(total_cost) AS cost
           FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
           AND sale_date >= CURRENT_DATE - ($1::int - 1)
           GROUP BY sale_date::date
         ),
         exp AS (
           SELECT expense_date AS day, SUM(amount) AS expenses
           FROM expenses WHERE deleted_at IS NULL AND status = 'pago'
           AND expense_date >= CURRENT_DATE - ($1::int - 1)
           GROUP BY expense_date
         )
         SELECT d.day,
                COALESCE(rev.revenue, 0) AS revenue,
                COALESCE(exp.expenses, 0) AS expenses,
                COALESCE(rev.revenue, 0) - COALESCE(rev.cost, 0) - COALESCE(exp.expenses, 0) AS profit
         FROM days d
         LEFT JOIN rev ON rev.day = d.day
         LEFT JOIN exp ON exp.day = d.day
         ORDER BY d.day`,
        [days]
      ),
      query(
        `SELECT payment_method, COALESCE(SUM(total),0) AS total
         FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
         AND date_trunc('month', sale_date) = date_trunc('month', CURRENT_DATE)
         GROUP BY payment_method`
      ),
      // Fluxo de caixa do mês corrente (livro-caixa real, não estimado)
      query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE direction = 'entrada'), 0) AS entries,
           COALESCE(SUM(amount) FILTER (WHERE direction = 'saida'), 0) AS exits
         FROM cash_movements
         WHERE date_trunc('month', movement_date) = date_trunc('month', CURRENT_DATE)`
      ),
      // Saldo acumulado desde o início (todas as entradas menos todas as saídas)
      query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE direction = 'entrada'), 0) AS entries,
           COALESCE(SUM(amount) FILTER (WHERE direction = 'saida'), 0) AS exits
         FROM cash_movements`
      ),
      // Vendas recentes
      query(
        `SELECT s.id, s.sale_number, s.sale_date, s.total, s.payment_method, s.sale_type, s.status,
                c.name AS customer_name
         FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.deleted_at IS NULL
         ORDER BY s.sale_date DESC
         LIMIT 8`
      ),
      // Próximos recebimentos (parcelas de venda ainda em aberto)
      query(
        `SELECT i.id, i.due_date, i.amount, i.paid_amount, i.status,
                s.sale_number, c.name AS customer_name
         FROM installments i
         JOIN sales s ON s.id = i.sale_id
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE i.status IN ('pendente','parcial','vencido') AND s.deleted_at IS NULL
         ORDER BY i.due_date ASC
         LIMIT 8`
      ),
      // Carteira de empréstimos (dados reais de loans/loan_installments/loan_payments)
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status <> 'cancelado') AS active_count,
           COUNT(*) FILTER (WHERE status = 'vencido') AS overdue_count,
           COALESCE(SUM(principal_amount) FILTER (WHERE status <> 'cancelado'), 0) AS loaned_total,
           COALESCE((SELECT SUM(amount) FROM loan_payments lp
             JOIN loans l2 ON l2.id = lp.loan_id WHERE l2.deleted_at IS NULL), 0) AS received_total,
           COALESCE(SUM(
             CASE WHEN is_open_ended THEN
               GREATEST(total_amount - (SELECT COALESCE(SUM(amount),0) FROM loan_payments WHERE loan_id = loans.id), 0)
             ELSE
               (SELECT COALESCE(SUM(amount - paid_amount),0) FROM loan_installments WHERE loan_id = loans.id AND status NOT IN ('cancelado'))
             END
           ) FILTER (WHERE status NOT IN ('cancelado','pago')), 0) AS open_total,
           COALESCE(SUM(
             CASE WHEN is_open_ended THEN
               GREATEST(total_amount - (SELECT COALESCE(SUM(amount),0) FROM loan_payments WHERE loan_id = loans.id), 0)
             ELSE
               (SELECT COALESCE(SUM(amount - paid_amount),0) FROM loan_installments WHERE loan_id = loans.id AND status NOT IN ('cancelado'))
             END
           ) FILTER (WHERE status = 'vencido'), 0) AS overdue_total
         FROM loans WHERE deleted_at IS NULL`
      ),
      // Estoque em atenção: produtos com estoque baixo ou zerado, produto a produto
      query(
        `SELECT id, name, sku, quantity, min_stock, image_url,
                CASE WHEN quantity = 0 THEN 'sem_estoque' ELSE 'baixo' END AS stock_status
         FROM products
         WHERE deleted_at IS NULL AND status = 'ativo' AND quantity <= min_stock
         ORDER BY quantity ASC
         LIMIT 10`
      ),
    ]);

    const monthTotal = Number(monthRows.rows[0].total);
    const monthCost = Number(monthRows.rows[0].cost);
    const monthExpenses = Number(expenseRows.rows[0].total);
    const grossProfit = monthTotal - monthCost;
    const netProfit = grossProfit - monthExpenses;

    const prevMonthTotal = Number(prevMonthRows.rows[0].total);
    const prevMonthCost = Number(prevMonthRows.rows[0].cost);
    const prevMonthExpenses = Number(prevExpenseRows.rows[0].total);
    const prevNetProfit = (prevMonthTotal - prevMonthCost) - prevMonthExpenses;

    // Variação percentual vs. mês anterior. Só calcula quando há base de
    // comparação (mês anterior > 0) — nunca inventa percentual quando não
    // existe histórico suficiente (ex: primeiro mês de uso do sistema).
    function percentChange(current, previous) {
      if (!previous || previous === 0) return null;
      return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
    }

    const avista = saleTypeRows.rows.find((r) => r.sale_type === 'avista');
    const aprazo = saleTypeRows.rows.find((r) => r.sale_type === 'aprazo');

    const cashEntriesMonth = Number(cashFlowMonthRows.rows[0].entries);
    const cashExitsMonth = Number(cashFlowMonthRows.rows[0].exits);
    const cashEntriesTotal = Number(cashFlowTotalRows.rows[0].entries);
    const cashExitsTotal = Number(cashFlowTotalRows.rows[0].exits);

    res.json({
      // --- campos originais, preservados ---
      revenueToday: Number(dayRows.rows[0].total),
      salesToday: Number(dayRows.rows[0].count),
      revenueMonth: monthTotal,
      salesMonth: Number(monthRows.rows[0].count),
      avistaMonth: avista ? Number(avista.total) : 0,
      aprazoMonth: aprazo ? Number(aprazo.total) : 0,
      receivedInstallmentsMonth: Number(receivedInstallmentsRows.rows[0].total),
      pendingReceivable: Number(receivableRows.rows[0].pending),
      expensesMonth: monthExpenses,
      overdueExpenses: Number(overdueExpenseRows.rows[0].count),
      grossProfitMonth: grossProfit,
      netProfitMonth: netProfit,
      lowStockCount: Number(stockRows.rows[0].low_stock),
      stockCostValue: Number(stockRows.rows[0].stock_cost_value),
      stockSaleValue: Number(stockRows.rows[0].stock_sale_value),
      dailyRevenue: chartRows.rows.map((r) => ({ day: r.day, total: Number(r.revenue) })),
      paymentMethods: paymentMethodRows.rows.map((r) => ({ method: r.payment_method, total: Number(r.total) })),

      // --- comparativo com o mês anterior ---
      comparison: {
        revenueMonth: { value: monthTotal, previous: prevMonthTotal, changePct: percentChange(monthTotal, prevMonthTotal) },
        netProfitMonth: { value: netProfit, previous: prevNetProfit, changePct: percentChange(netProfit, prevNetProfit) },
      },

      // --- série completa do gráfico de desempenho (receita/despesas/lucro) ---
      performanceChart: {
        days,
        series: chartRows.rows.map((r) => ({
          day: r.day,
          revenue: Number(r.revenue),
          expenses: Number(r.expenses),
          profit: Number(r.profit),
        })),
      },

      // --- fluxo de caixa ---
      cashFlow: {
        entriesMonth: cashEntriesMonth,
        exitsMonth: cashExitsMonth,
        balanceMonth: cashEntriesMonth - cashExitsMonth,
        balanceTotal: cashEntriesTotal - cashExitsTotal,
      },

      // --- vendas recentes ---
      recentSales: recentSalesRows.rows.map((r) => ({
        id: r.id,
        saleNumber: r.sale_number,
        saleDate: r.sale_date,
        customerName: r.customer_name,
        total: Number(r.total),
        paymentMethod: r.payment_method,
        saleType: r.sale_type,
        status: r.status,
      })),

      // --- próximos recebimentos ---
      upcomingReceivables: upcomingReceivablesRows.rows.map((r) => ({
        id: r.id,
        saleNumber: r.sale_number,
        customerName: r.customer_name,
        dueDate: r.due_date,
        amount: Number(r.amount) - Number(r.paid_amount),
        status: r.status,
      })),

      // --- carteira de empréstimos ---
      loanPortfolio: {
        activeCount: Number(loanPortfolioRows.rows[0].active_count),
        overdueCount: Number(loanPortfolioRows.rows[0].overdue_count),
        loanedTotal: Number(loanPortfolioRows.rows[0].loaned_total),
        receivedTotal: Number(loanPortfolioRows.rows[0].received_total),
        openTotal: Number(loanPortfolioRows.rows[0].open_total),
        overdueTotal: Number(loanPortfolioRows.rows[0].overdue_total),
      },

      // --- estoque em atenção ---
      lowStockItems: lowStockRows.rows.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        quantity: r.quantity,
        minStock: r.min_stock,
        imageUrl: r.image_url,
        status: r.stock_status,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
