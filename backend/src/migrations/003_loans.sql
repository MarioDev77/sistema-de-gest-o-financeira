-- Migration 003: empréstimos de dinheiro e fechamento mensal
-- O que muda: cria loans, loan_installments, loan_payments, monthly_closings.
-- Por que: suportar o módulo de Empréstimos e o botão "Fechar Mês".
-- Tabelas afetadas: novas.
-- Impacto: nenhum em dados existentes.
-- Como desfazer: 003_loans_down.sql

CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  person_name VARCHAR(150) NOT NULL,
  document VARCHAR(20),
  phone VARCHAR(20),
  principal_amount NUMERIC(12,2) NOT NULL CHECK (principal_amount > 0),
  interest_type VARCHAR(20) NOT NULL CHECK (interest_type IN ('fixo','simples','por_parcela')),
  interest_percentage NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (interest_percentage >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  loan_date DATE NOT NULL,
  due_date DATE,
  installments_count INTEGER NOT NULL DEFAULT 1 CHECK (installments_count >= 1),
  payment_method VARCHAR(20) CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pago','parcial','vencido','cancelado')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);
DROP TRIGGER IF EXISTS trg_loans_updated_at ON loans;
CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS loan_installments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','parcial','vencido','cancelado')),
  UNIQUE (loan_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_loan_installments_due ON loan_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_installments_status ON loan_installments(status);

CREATE TABLE IF NOT EXISTS loan_payments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_id INTEGER REFERENCES loan_installments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  principal_portion NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_portion NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);

CREATE TABLE IF NOT EXISTS monthly_closings (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue NUMERIC(12,2) NOT NULL,
  costs NUMERIC(12,2) NOT NULL,
  expenses NUMERIC(12,2) NOT NULL,
  gross_profit NUMERIC(12,2) NOT NULL,
  net_profit NUMERIC(12,2) NOT NULL,
  loaned_amount NUMERIC(12,2) NOT NULL,
  received_loan_amount NUMERIC(12,2) NOT NULL,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month)
);
