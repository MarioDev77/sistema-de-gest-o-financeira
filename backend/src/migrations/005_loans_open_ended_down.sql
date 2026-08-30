-- Reverte 005_loans_open_ended.sql
-- Atenção: se existir algum empréstimo com is_open_ended = TRUE, ele precisa
-- ganhar um installments_count antes de rodar isto, senão o NOT NULL falha.

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_installments_count_check;
ALTER TABLE loans ADD CONSTRAINT loans_installments_count_check CHECK (installments_count >= 1);

ALTER TABLE loans ALTER COLUMN installments_count SET NOT NULL;
ALTER TABLE loans DROP COLUMN IF EXISTS is_open_ended;
