const PDFDocument = require('pdfkit');

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Datas de calendário (DATE, sem horário) não podem passar por conversão de
// fuso horário — ler os dígitos direto da string evita o "um dia atrás" que
// `new Date(date).toLocaleDateString()` causa quando o servidor roda fora de UTC.
function formatDate(date) {
  if (!date) return '—';
  const str = typeof date === 'string' ? date : date.toISOString();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return new Date(date).toLocaleDateString('pt-BR');
}

/**
 * Cria um PDFDocument já com cabeçalho padrão (título + data de geração) e
 * devolve o doc pronto pra receber o conteúdo específico do relatório.
 */
function createReportDoc(res, filename, title) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(18).fillColor('#14161C').text(title, { align: 'left' });
  doc.fontSize(9).fillColor('#8B8F99').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`);
  doc.moveDown(1);
  doc.strokeColor('#B8863B').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);
  doc.fillColor('#14161C');

  return doc;
}

function drawTableRow(doc, columns, y, { bold = false, color = '#14161C' } = {}) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(color);
  let x = 50;
  columns.forEach((col) => {
    doc.text(col.text, x, y, { width: col.width, align: col.align || 'left' });
    x += col.width;
  });
}

module.exports = { formatBRL, formatDate, createReportDoc, drawTableRow };
