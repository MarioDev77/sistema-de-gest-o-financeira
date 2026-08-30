const { query } = require('../config/db');

/**
 * Reúne dados reais do banco para a análise. A IA (quando configurada) só
 * recebe estes números — nunca inventa vendas, produtos ou valores que não
 * estejam aqui.
 */
async function collectRealData(monthStart) {
  const { rows: topProducts } = await query(
    `SELECT p.name, SUM(si.quantity) AS qty, SUM(si.line_total) AS revenue, SUM(si.line_total - si.unit_cost * si.quantity) AS profit
     FROM sale_items si JOIN products p ON p.id = si.product_id JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'concluida' AND s.deleted_at IS NULL AND date_trunc('month', s.sale_date) = $1::date
     GROUP BY p.name ORDER BY revenue DESC LIMIT 5`,
    [monthStart]
  );

  const { rows: slowProducts } = await query(
    `SELECT p.name, p.quantity, p.min_stock FROM products p
     WHERE p.deleted_at IS NULL AND p.status = 'ativo'
     AND NOT EXISTS (
       SELECT 1 FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.product_id = p.id AND date_trunc('month', s.sale_date) = $1::date
     )
     ORDER BY p.quantity DESC LIMIT 5`,
    [monthStart]
  );

  const { rows: topExpenses } = await query(
    `SELECT category, SUM(amount) AS total FROM expenses
     WHERE deleted_at IS NULL AND date_trunc('month', expense_date) = $1::date
     GROUP BY category ORDER BY total DESC LIMIT 5`,
    [monthStart]
  );

  const { rows: pendingCustomers } = await query(
    `SELECT c.name, SUM(i.amount - i.paid_amount) AS pending
     FROM installments i JOIN sales s ON s.id = i.sale_id JOIN customers c ON c.id = s.customer_id
     WHERE i.status IN ('pendente','parcial','vencido')
     GROUP BY c.name ORDER BY pending DESC LIMIT 10`
  );

  const { rows: overdueLoans } = await query(
    `SELECT person_name, total_amount, due_date FROM loans
     WHERE status = 'vencido' AND deleted_at IS NULL ORDER BY due_date`
  );

  const { rows: monthlyEvolution } = await query(
    `SELECT date_trunc('month', sale_date) AS month, SUM(total) AS revenue
     FROM sales WHERE status = 'concluida' AND deleted_at IS NULL
     AND sale_date >= $1::date - INTERVAL '5 months'
     GROUP BY month ORDER BY month`,
    [monthStart]
  );

  return { topProducts, slowProducts, topExpenses, pendingCustomers, overdueLoans, monthlyEvolution };
}

async function callAnthropicForRecommendations(data) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
  const prompt = `Você é um analista financeiro. Com base SOMENTE nos dados reais abaixo (nunca invente números), escreva em português: 1) um resumo do mês, 2) recomendações práticas. Deixe claro que as recomendações são estimativas/sugestões, não fatos.\n\nDados reais:\n${JSON.stringify(data, null, 2)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error('Falha ao chamar a API da Anthropic:', await response.text());
    return null;
  }

  const json = await response.json();
  const textBlock = json.content?.find((c) => c.type === 'text');
  return textBlock?.text || null;
}

async function getAiAnalysis(req, res, next) {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const realData = await collectRealData(monthStart);
    const recommendations = await callAnthropicForRecommendations(realData);

    res.json({
      period: { year, month },
      dadosReais: realData,
      recomendacoes: recommendations,
      recomendacoesDisponiveis: Boolean(recommendations),
      aviso: recommendations
        ? 'As recomendações acima são geradas por IA a partir dos dados reais e devem ser tratadas como sugestão, não como fato.'
        : 'ANTHROPIC_API_KEY não configurada no backend — mostrando apenas os dados reais agregados, sem narrativa gerada por IA.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAiAnalysis };
