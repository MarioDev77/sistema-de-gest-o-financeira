ALTER TABLE loan_installments DROP COLUMN IF EXISTS interest_amount;
ALTER TABLE loan_installments DROP COLUMN IF EXISTS principal_amount;

ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_category_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_category_check
  CHECK (category IN ('venda','recebimento_venda','outra_receita','recebimento_emprestimo','juros_emprestimo','despesa','fornecedor','emprestimo_concedido','outra_saida'));
