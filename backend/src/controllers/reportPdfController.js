const { query } = require('../config/db');
const { formatBRL, formatDate, createReportDoc, drawTableRow } = require('../utils/pdfHelpers');

function periodFilter(req) {
  const { from, to } = req.query;
  return {
    from: from || '1900-01-01',
    to: to || '2999-12-31',
    label: from || to ? `${from || '...'} a ${to || '...'}` : 'todo o período',
  };
}

async function salesReportPdf(req, res, next) {
  try {
    const { from, to, label } = periodFilter(req);
    const { rows } = await query(
      `SELECT s.sale_number, s.sale_date, s.sale_type, s.total, s.total_cost, s.profit, s.status, c.name AS customer_name
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.deleted_at IS NULL AND s.sale_date::date BETWEEN $1 AND $2
       ORDER BY s.sale_date`,
      [from, to]
    );

    const doc = createReportDoc(res, 'relatorio-vendas.pdf', 'Relatório Completo de Vendas');
    doc.fontSize(10).text(`Período: ${label}`);
    doc.moveDown(0.5);

    const columns = [
      { text: 'Nº', width: 70 }, { text: 'Data', width: 70 }, { text: 'Cliente', width: 140 },
      { text: 'Tipo', width: 60 }, { text: 'Total', width: 70, align: 'right' }, { text: 'Lucro', width: 70, align: 'right' },
    ];
    let y = doc.y;
    drawTableRow(doc, columns, y, { bold: true });
    y += 16;

    let totalRevenue = 0, totalCost = 0, totalProfit = 0, count = 0;
    rows.forEach((s) => {
      if (y > 750) { doc.addPage(); y = 50; }
      drawTableRow(doc, [
        { ...columns[0], text: s.sale_number },
        { ...columns[1], text: formatDate(s.sale_date) },
        { ...columns[2], text: s.customer_name || '—' },
        { ...columns[3], text: s.sale_type === 'avista' ? 'À vista' : 'A prazo' },
        { ...columns[4], text: formatBRL(s.total) },
        { ...columns[5], text: formatBRL(s.profit) },
      ], y);
      y += 14;
      totalRevenue += Number(s.total);
      totalCost += Number(s.total_cost);
      totalProfit += Number(s.profit);
      count += 1;
    });

    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(11).text('Resumo do período', { underline: true });
    doc.font('Helvetica').fontSize(10);
    doc.text(`Quantidade de vendas: ${count}`);
    doc.text(`Faturamento: ${formatBRL(totalRevenue)}`);
    doc.text(`Custos: ${formatBRL(totalCost)}`);
    doc.text(`Lucro: ${formatBRL(totalProfit)}`);

    doc.end();
  } catch (err) {
    next(err);
  }
}

async function expensesReportPdf(req, res, next) {
  try {
    const { from, to, label } = periodFilter(req);
    const { rows } = await query(
      `SELECT description, category, amount, expense_date, status FROM expenses
       WHERE deleted_at IS NULL AND expense_date BETWEEN $1 AND $2 ORDER BY expense_date`,
      [from, to]
    );

    const doc = createReportDoc(res, 'relatorio-despesas.pdf', 'Relatório de Despesas');
    doc.fontSize(10).text(`Período: ${label}`);
    doc.moveDown(0.5);

    const columns = [
      { text: 'Data', width: 70 }, { text: 'Descrição', width: 180 },
      { text: 'Categoria', width: 100 }, { text: 'Status', width: 70 },
      { text: 'Valor', width: 90, align: 'right' },
    ];
    let y = doc.y;
    drawTableRow(doc, columns, y, { bold: true });
    y += 16;

    let total = 0;
    rows.forEach((e) => {
      if (y > 750) { doc.addPage(); y = 50; }
      drawTableRow(doc, [
        { ...columns[0], text: formatDate(e.expense_date) },
        { ...columns[1], text: e.description },
        { ...columns[2], text: e.category },
        { ...columns[3], text: e.status },
        { ...columns[4], text: formatBRL(e.amount) },
      ], y);
      y += 14;
      total += Number(e.amount);
    });

    doc.moveDown(2);
    doc.font('Helvetica-Bold').text(`Total do período: ${formatBRL(total)}`);
    doc.end();
  } catch (err) {
    next(err);
  }
}

async function cashFlowReportPdf(req, res, next) {
  try {
    const { from, to, label } = periodFilter(req);
    const { rows } = await query(
      `SELECT direction, category, amount, description, movement_date FROM cash_movements
       WHERE movement_date::date BETWEEN $1 AND $2 ORDER BY movement_date`,
      [from, to]
    );

    const doc = createReportDoc(res, 'relatorio-fluxo-caixa.pdf', 'Relatório de Fluxo de Caixa');
    doc.fontSize(10).text(`Período: ${label}`);
    doc.moveDown(0.5);

    const columns = [
      { text: 'Data', width: 70 }, { text: 'Direção', width: 60 },
      { text: 'Categoria', width: 130 }, { text: 'Descrição', width: 150 },
      { text: 'Valor', width: 90, align: 'right' },
    ];
    let y = doc.y;
    drawTableRow(doc, columns, y, { bold: true });
    y += 16;

    let totalIn = 0, totalOut = 0;
    rows.forEach((m) => {
      if (y > 750) { doc.addPage(); y = 50; }
      drawTableRow(doc, [
        { ...columns[0], text: formatDate(m.movement_date) },
        { ...columns[1], text: m.direction === 'entrada' ? 'Entrada' : 'Saída' },
        { ...columns[2], text: m.category },
        { ...columns[3], text: m.description || '—' },
        { ...columns[4], text: formatBRL(m.amount) },
      ], y);
      y += 14;
      if (m.direction === 'entrada') totalIn += Number(m.amount); else totalOut += Number(m.amount);
    });

    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(11).text('Resumo', { underline: true });
    doc.font('Helvetica').fontSize(10);
    doc.text(`Total de entradas: ${formatBRL(totalIn)}`);
    doc.text(`Total de saídas: ${formatBRL(totalOut)}`);
    doc.text(`Saldo do período: ${formatBRL(totalIn - totalOut)}`);
    doc.end();
  } catch (err) {
    next(err);
  }
}

async function loansReportPdf(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT person_name, principal_amount, total_amount, status, loan_date, due_date,
         COALESCE((SELECT SUM(paid_amount) FROM loan_installments WHERE loan_id = loans.id), 0) AS received
       FROM loans WHERE deleted_at IS NULL ORDER BY loan_date DESC`
    );

    const doc = createReportDoc(res, 'relatorio-emprestimos.pdf', 'Relatório de Empréstimos');
    const columns = [
      { text: 'Pessoa', width: 130 }, { text: 'Principal', width: 80, align: 'right' },
      { text: 'Total', width: 80, align: 'right' }, { text: 'Recebido', width: 80, align: 'right' },
      { text: 'Status', width: 80 }, { text: 'Vencimento', width: 60 },
    ];
    let y = doc.y;
    drawTableRow(doc, columns, y, { bold: true });
    y += 16;

    let totalPrincipal = 0, totalReceived = 0;
    rows.forEach((l) => {
      if (y > 750) { doc.addPage(); y = 50; }
      drawTableRow(doc, [
        { ...columns[0], text: l.person_name },
        { ...columns[1], text: formatBRL(l.principal_amount) },
        { ...columns[2], text: formatBRL(l.total_amount) },
        { ...columns[3], text: formatBRL(l.received) },
        { ...columns[4], text: l.status },
        { ...columns[5], text: l.due_date ? formatDate(l.due_date) : '—' },
      ], y);
      y += 14;
      totalPrincipal += Number(l.principal_amount);
      totalReceived += Number(l.received);
    });

    doc.moveDown(2);
    doc.font('Helvetica-Bold').text(`Total emprestado: ${formatBRL(totalPrincipal)}  |  Total recebido: ${formatBRL(totalReceived)}`);
    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { salesReportPdf, expensesReportPdf, cashFlowReportPdf, loansReportPdf };
