const ExcelJS = require('exceljs');
const { query } = require('../config/db');

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
  return sheet;
}

/**
 * Gera um workbook único com as planilhas do relatório financeiro completo.
 * Cobre 10 das 11 planilhas do escopo original (Vendas, Produtos, Estoque,
 * Clientes, Contas a Receber, Despesas, Fluxo de Caixa, Empréstimos,
 * Pagamentos de Empréstimos, Balancete) — "Resumo Financeiro" ficou
 * incorporado na aba Balancete em vez de uma aba separada.
 */
async function exportExcel(req, res, next) {
  try {
    const { from, to } = req.query;
    const start = from || '1900-01-01';
    const end = to || '2999-12-31';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gestão Financeira Perfumaria';
    workbook.created = new Date();

    const { rows: sales } = await query(
      `SELECT s.sale_number, s.sale_date, c.name AS customer, s.sale_type, s.payment_method,
              s.total, s.total_cost, s.profit, s.status
       FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.deleted_at IS NULL AND s.sale_date::date BETWEEN $1 AND $2 ORDER BY s.sale_date`,
      [start, end]
    );
    addSheet(workbook, 'Vendas', [
      { header: 'Número', key: 'sale_number', width: 14 },
      { header: 'Data', key: 'sale_date', width: 14 },
      { header: 'Cliente', key: 'customer', width: 24 },
      { header: 'Tipo', key: 'sale_type', width: 10 },
      { header: 'Pagamento', key: 'payment_method', width: 14 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Custo', key: 'total_cost', width: 12 },
      { header: 'Lucro', key: 'profit', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ], sales);

    const { rows: products } = await query(
      `SELECT p.name, c.name AS category, p.quantity, p.min_stock, p.cost, p.price, p.status
       FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.deleted_at IS NULL ORDER BY p.name`
    );
    addSheet(workbook, 'Produtos', [
      { header: 'Nome', key: 'name', width: 28 },
      { header: 'Categoria', key: 'category', width: 18 },
      { header: 'Quantidade', key: 'quantity', width: 12 },
      { header: 'Estoque mínimo', key: 'min_stock', width: 14 },
      { header: 'Custo', key: 'cost', width: 12 },
      { header: 'Preço', key: 'price', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
    ], products);

    const { rows: movements } = await query(
      `SELECT m.created_at, p.name AS product, m.direction, m.reason, m.quantity, m.notes
       FROM stock_movements m JOIN products p ON p.id = m.product_id
       WHERE m.created_at::date BETWEEN $1 AND $2 ORDER BY m.created_at`,
      [start, end]
    );
    addSheet(workbook, 'Estoque', [
      { header: 'Data', key: 'created_at', width: 16 },
      { header: 'Produto', key: 'product', width: 26 },
      { header: 'Direção', key: 'direction', width: 10 },
      { header: 'Motivo', key: 'reason', width: 12 },
      { header: 'Quantidade', key: 'quantity', width: 12 },
      { header: 'Observações', key: 'notes', width: 24 },
    ], movements);

    const { rows: customers } = await query(
      `SELECT name, document, phone, email FROM customers WHERE deleted_at IS NULL ORDER BY name`
    );
    addSheet(workbook, 'Clientes', [
      { header: 'Nome', key: 'name', width: 26 },
      { header: 'CPF/CNPJ', key: 'document', width: 18 },
      { header: 'Telefone', key: 'phone', width: 16 },
      { header: 'E-mail', key: 'email', width: 24 },
    ], customers);

    const { rows: receivable } = await query(
      `SELECT s.sale_number, c.name AS customer, i.due_date, i.amount, i.paid_amount, i.status
       FROM installments i JOIN sales s ON s.id = i.sale_id LEFT JOIN customers c ON c.id = s.customer_id
       WHERE i.status IN ('pendente','parcial','vencido') ORDER BY i.due_date`
    );
    addSheet(workbook, 'Contas a Receber', [
      { header: 'Venda', key: 'sale_number', width: 14 },
      { header: 'Cliente', key: 'customer', width: 24 },
      { header: 'Vencimento', key: 'due_date', width: 14 },
      { header: 'Valor', key: 'amount', width: 12 },
      { header: 'Pago', key: 'paid_amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ], receivable);

    const { rows: expenses } = await query(
      `SELECT description, category, amount, expense_date, status FROM expenses
       WHERE deleted_at IS NULL AND expense_date BETWEEN $1 AND $2 ORDER BY expense_date`,
      [start, end]
    );
    addSheet(workbook, 'Despesas', [
      { header: 'Descrição', key: 'description', width: 28 },
      { header: 'Categoria', key: 'category', width: 16 },
      { header: 'Valor', key: 'amount', width: 12 },
      { header: 'Data', key: 'expense_date', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ], expenses);

    const { rows: cashMovements } = await query(
      `SELECT movement_date, direction, category, amount, description FROM cash_movements
       WHERE movement_date::date BETWEEN $1 AND $2 ORDER BY movement_date`,
      [start, end]
    );
    addSheet(workbook, 'Fluxo de Caixa', [
      { header: 'Data', key: 'movement_date', width: 16 },
      { header: 'Direção', key: 'direction', width: 10 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Valor', key: 'amount', width: 12 },
      { header: 'Descrição', key: 'description', width: 26 },
    ], cashMovements);

    const { rows: loans } = await query(
      `SELECT person_name, principal_amount, interest_type, interest_percentage, total_amount, status, loan_date, due_date
       FROM loans WHERE deleted_at IS NULL ORDER BY loan_date DESC`
    );
    addSheet(workbook, 'Empréstimos', [
      { header: 'Pessoa', key: 'person_name', width: 22 },
      { header: 'Principal', key: 'principal_amount', width: 12 },
      { header: 'Tipo Juros', key: 'interest_type', width: 12 },
      { header: 'Juros (%)', key: 'interest_percentage', width: 10 },
      { header: 'Total', key: 'total_amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Data', key: 'loan_date', width: 14 },
      { header: 'Vencimento', key: 'due_date', width: 14 },
    ], loans);

    const { rows: loanPayments } = await query(
      `SELECT lp.payment_date, l.person_name, lp.amount, lp.principal_portion, lp.interest_portion, lp.payment_method
       FROM loan_payments lp JOIN loans l ON l.id = lp.loan_id
       WHERE lp.payment_date::date BETWEEN $1 AND $2 ORDER BY lp.payment_date`,
      [start, end]
    );
    addSheet(workbook, 'Pagamentos de Empréstimos', [
      { header: 'Data', key: 'payment_date', width: 16 },
      { header: 'Pessoa', key: 'person_name', width: 22 },
      { header: 'Valor', key: 'amount', width: 12 },
      { header: 'Principal', key: 'principal_portion', width: 12 },
      { header: 'Juros', key: 'interest_portion', width: 12 },
      { header: 'Forma', key: 'payment_method', width: 14 },
    ], loanPayments);

    const totalRevenue = sales.filter((s) => s.status === 'concluida').reduce((sum, s) => sum + Number(s.total), 0);
    const totalCost = sales.filter((s) => s.status === 'concluida').reduce((sum, s) => sum + Number(s.total_cost), 0);
    const totalExpenses = expenses.filter((e) => e.status === 'pago').reduce((sum, e) => sum + Number(e.amount), 0);
    addSheet(workbook, 'Balancete', [
      { header: 'Indicador', key: 'label', width: 30 },
      { header: 'Valor', key: 'value', width: 16 },
    ], [
      { label: 'Faturamento', value: totalRevenue },
      { label: 'Custos', value: totalCost },
      { label: 'Despesas pagas', value: totalExpenses },
      { label: 'Lucro Bruto', value: totalRevenue - totalCost },
      { label: 'Lucro Líquido', value: totalRevenue - totalCost - totalExpenses },
    ]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-financeiro-completo.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportExcel };
