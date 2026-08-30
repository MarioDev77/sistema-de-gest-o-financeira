-- Migration 006: corrige bug dos recibos avulsos + detalha juros por parcela
-- O que muda:
--   1) A tabela cash_movements tinha uma constraint de categoria que NUNCA
--      incluiu 'recibo_recebido'/'recibo_cancelado', usadas pelo controller
--      de recibos (receiptController.js) desde a migration 004. Resultado:
--      todo POST /api/receipts (novo recibo) e todo cancelamento de recibo
--      violava a CHECK constraint do Postgres (erro 23514) e o usuário via
--      a mensagem genérica "Valor inválido para um dos campos." mesmo
--      preenchendo tudo certo. Aqui a constraint é recriada incluindo essas
--      categorias.
--   2) loan_installments passa a guardar o valor de juros e de principal já
--      separados por parcela (interest_amount / principal_amount), em vez de
--      só o total. Isso permite mostrar e editar, mês a mês, quanto de cada
--      parcela é juros — sem precisar esperar o recebimento ser registrado.
--      Parcelas existentes são preenchidas (backfill) proporcionalmente ao
--      juros total do empréstimo.
-- Tabelas afetadas: cash_movements, loan_installments.
-- Impacto: nenhuma perda de dado; amount total da parcela não muda.
-- Como desfazer: 006_fix_receipts_and_installment_split_down.sql

ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_category_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_category_check
  CHECK (category IN (
    'venda','recebimento_venda','outra_receita','recebimento_emprestimo','juros_emprestimo',
    'despesa','fornecedor','emprestimo_concedido','outra_saida',
    'recibo_recebido','recibo_cancelado',
    'divida_recebida','divida_paga','divida_cancelada'
  ));

ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE loan_installments ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill: reparte o valor de cada parcela já existente entre juros e
-- principal, na mesma proporção do empréstimo como um todo.
UPDATE loan_installments li
SET
  interest_amount = ROUND(li.amount * COALESCE((l.total_amount - l.principal_amount) / NULLIF(l.total_amount, 0), 0), 2),
  principal_amount = li.amount - ROUND(li.amount * COALESCE((l.total_amount - l.principal_amount) / NULLIF(l.total_amount, 0), 0), 2)
FROM loans l
WHERE li.loan_id = l.id;
