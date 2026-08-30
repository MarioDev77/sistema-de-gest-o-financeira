-- Reversão da migration 004: remove a tabela receipts.
DROP TRIGGER IF EXISTS trg_receipts_updated_at ON receipts;
DROP TABLE IF EXISTS receipts;
