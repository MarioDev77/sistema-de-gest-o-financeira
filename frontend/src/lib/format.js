export function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata uma data de calendário (colunas DATE do banco: loan_date, due_date,
 * expense_date, receipt_date, debt_date, etc.) como dd/mm/aaaa.
 *
 * Bug corrigido: essas colunas não têm horário, mas chegam do backend como
 * "2026-01-21T00:00:00.000Z" (meia-noite UTC). Usar `new Date(value).toLocaleDateString()`
 * converte para o fuso local (ex: America/Sao_Paulo, UTC-3) antes de extrair o
 * dia, o que fazia meia-noite de UTC virar 21h do dia anterior — todo
 * calendário aparecia um dia atrás do que estava salvo. A correção lê os
 * dígitos ano-mês-dia direto da string, sem passar por nenhuma conversão de
 * fuso horário, já que aqui só nos importa a data do calendário, não um
 * instante no tempo.
 */
export function shortDate(value) {
  if (!value) return '—';
  const str = typeof value === 'string' ? value : value.toISOString();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  return new Date(value).toLocaleDateString('pt-BR');
}

export function dateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const PAYMENT_METHOD_LABELS = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito',
  transferencia: 'Transferência', outros: 'Outros',
};

export function paymentMethodLabel(value) {
  return PAYMENT_METHOD_LABELS[value] || value || '—';
}
