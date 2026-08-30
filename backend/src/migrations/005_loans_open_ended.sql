-- Migration 005: empréstimos com prazo indeterminado + limite de 48 parcelas
-- O que muda: permite installments_count = NULL quando o empréstimo é "sem
-- prazo fixo" (juros cobrados mês a mês, sem parcelas pré-geradas), e trava
-- o número de parcelas normal entre 1 e 48 (1 a cada 1 mês).
-- Tabelas afetadas: loans.
-- Impacto: nenhum em dados existentes (todo empréstimo já cadastrado tem
-- installments_count preenchido e is_open_ended assume FALSE por padrão).
-- Como desfazer: 005_loans_open_ended_down.sql

ALTER TABLE loans ADD COLUMN IF NOT EXISTS is_open_ended BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE loans ALTER COLUMN installments_count DROP NOT NULL;

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_installments_count_check;
ALTER TABLE loans ADD CONSTRAINT loans_installments_count_check
  CHECK (
    (is_open_ended = TRUE AND installments_count IS NULL)
    OR (is_open_ended = FALSE AND installments_count BETWEEN 1 AND 48)
  );
