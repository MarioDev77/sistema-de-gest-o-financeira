const { query } = require('../config/db');

// Balancete de um mês específico (?year=2026&month=8). Sem parâmetros, usa o mês atual.
async function getBalanceSheet(req, res, next) {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;

    const range = { start: `${year}-${String(month).padStart(2, '0')}-01` };

    const { rows: salesRows } = await query(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE sale_type = 'avista'), 0) AS avista,
         COALESCE(SUM(total) FILTER (WHERE sale_type = 'aprazo'), 0) AS aprazo_faturado,
         COALESCE(SUM(total_cost), 0) AS costs
       FROM sales
       WHERE status = 'concluida' AND deleted_at IS NULL
       AND date_trunc('month', sale_date) = $1::date`,
      [range.start]
    );

    const { rows: receivedInstallmentsRows } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments
       WHERE installment_id IS NOT NULL AND date_trunc('month', payment_date) = $1::date`,
      [range.start]
    );

    const { rows: expenseRows } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE deleted_at IS NULL AND status = 'pago' AND date_trunc('month', expense_date) = $1::date`,
      [range.start]
    );

    const { rows: cashRows } = await query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE category = 'emprestimo_concedido'), 0) AS loaned,
         COALESCE(SUM(amount) FILTER (WHERE category = 'recebimento_emprestimo'), 0) AS loan_principal_received,
         COALESCE(SUM(amount) FILTER (WHERE category = 'juros_emprestimo'), 0) AS interest_received,
         COALESCE(SUM(amount) FILTER (WHERE category = 'outra_receita'), 0) AS other_income,
         COALESCE(SUM(amount) FILTER (WHERE category = 'outra_saida' OR category = 'fornecedor'), 0) AS other_outflow
       FROM cash_movements WHERE date_trunc('month', movement_date) = $1::date`,
      [range.start]
    );

    const s = salesRows[0];
    const revenue = Number(s.avista) + Number(s.aprazo_faturado);
    const costs = Number(s.costs);
    const expensesTotal = Number(expenseRows[0].total);
    const interestReceived = Number(cashRows[0].interest_received);
    const grossProfit = revenue - costs;
    const netProfit = grossProfit - expensesTotal;

    res.json({
      period: { year, month },
      revenues: {
        avista: Number(s.avista),
        recebimentosAprazo: Number(receivedInstallmentsRows[0].total),
        outrasReceitas: Number(cashRows[0].other_income),
        jurosRecebidos: interestReceived,
      },
      saidas: {
        despesas: expensesTotal,
        emprestimosConcedidos: Number(cashRows[0].loaned),
        outrasSaidas: Number(cashRows[0].other_outflow),
      },
      resultados: {
        faturamento: revenue,
        custos: costs,
        despesas: expensesTotal,
        lucroBruto: grossProfit,
        lucroLiquido: netProfit,
        valoresEmprestados: Number(cashRows[0].loaned),
        valoresRecebidosEmprestimos: Number(cashRows[0].loan_principal_received) + interestReceived,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBalanceSheet };
