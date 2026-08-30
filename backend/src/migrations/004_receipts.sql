-- Migration 004: recibos (recebimentos avulsos)
-- O que muda: cria a tabela receipts.
-- Por que: registrar valores recebidos de uma pessoa (ex: "recebi R$300 de
-- Fulano"), sem precisar estar amarrado a uma parcela de empréstimo.
-- Tabelas afetadas: nova.
-- Impacto: nenhum em dados existentes.
-- Como desfazer: 004_receipts_down.sql

CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  person_name VARCHAR(150) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  receipt_date DATE NOT NULL,
  payment_method VARCHAR(20) CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','cancelado')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_person ON receipts(person_name);
DROP TRIGGER IF EXISTS trg_receipts_updated_at ON receipts;
CREATE TRIGGER trg_receipts_updated_at BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
