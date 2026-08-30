ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_interest_type_check;
ALTER TABLE loans ADD CONSTRAINT loans_interest_type_check
  CHECK (interest_type IN ('fixo','simples','por_parcela'));
