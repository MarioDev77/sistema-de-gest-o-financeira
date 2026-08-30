-- Migration 007: dívidas (o que eu devo)
-- O que muda: cria o módulo de "Dívidas" — o espelho de Empréstimos, mas
-- para dinheiro que EU peguei emprestado de alguém, só para controle e
-- lembrete (data de vencimento, parcelas, quanto já paguei).
-- Tabelas afetadas: novas (debts, debt_installments, debt_payments).
-- Impacto: nenhum em dados existentes.
-- Como desfazer: 007_debts_down.sql

CREATE TABLE IF NOT EXISTS debts (
  id SERIAL PRIMARY KEY,
  creditor_name VARCHAR(150) NOT NULL,
  document VARCHAR(20),
  phone VARCHAR(20),
  principal_amount NUMERIC(12,2) NOT NULL CHECK (principal_amount > 0),
  interest_type VARCHAR(20) NOT NULL DEFAULT 'fixo' CHECK (interest_type IN ('fixo','simples','por_parcela')),
  interest_percentage NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (interest_percentage >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  debt_date DATE NOT NULL,
  installments_count INTEGER CHECK (installments_count BETWEEN 1 AND 48),
  is_open_ended BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pago','parcial','vencido','cancelado')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (is_open_ended = TRUE AND installments_count IS NULL)
    OR (is_open_ended = FALSE AND installments_count BETWEEN 1 AND 48)
  )
);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_debts_updated_at ON debts;
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON debts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS debt_installments (
  id SERIAL PRIMARY KEY,
  debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  interest_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  principal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','parcial','vencido','cancelado')),
  UNIQUE (debt_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_debt_installments_due ON debt_installments(due_date);

CREATE TABLE IF NOT EXISTS debt_payments (
  id SERIAL PRIMARY KEY,
  debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  installment_id INTEGER REFERENCES debt_installments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  principal_portion NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_portion NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
