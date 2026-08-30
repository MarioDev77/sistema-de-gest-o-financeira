-- Migration 002: núcleo operacional (vendas, estoque, despesas, fluxo de caixa, auditoria)
-- O que muda: cria as tabelas de sales/sale_items/installments/payments,
-- stock_movements, expenses, cash_movements e audit_logs.
-- Por que: suportar os módulos de Vendas, Estoque, Despesas e Fluxo de Caixa.
-- Tabelas afetadas: novas, não mexe nas existentes.
-- Impacto: nenhum em dados já existentes.
-- Como desfazer: 002_core_operations_down.sql

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  sale_number VARCHAR(20) NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  sale_type VARCHAR(20) NOT NULL CHECK (sale_type IN ('avista','aprazo')),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  surcharge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (surcharge >= 0),
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  total_cost NUMERIC(12,2) NOT NULL CHECK (total_cost >= 0),
  profit NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida','cancelada')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_sales_updated_at ON sales;
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS installments (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','parcial','vencido','cancelado')),
  UNIQUE (sale_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_installments_due ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  installment_id INTEGER REFERENCES installments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_installment ON payments(installment_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('entrada','saida')),
  reason VARCHAR(20) NOT NULL CHECK (reason IN ('compra','venda','devolucao','perda','ajuste')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reference_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  description VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('aluguel','energia','agua','internet','funcionarios','fornecedores','transporte','marketing','embalagens','impostos','manutencao','outros')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  due_date DATE,
  payment_method VARCHAR(20) CHECK (payment_method IN ('dinheiro','pix','debito','credito','transferencia','outros')),
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido','cancelado')),
  receipt_url TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Livro-caixa: todo dinheiro que entra/sai é lançado aqui, vindo de vendas,
-- despesas ou (na próxima migration) de empréstimos.
CREATE TABLE IF NOT EXISTS cash_movements (
  id SERIAL PRIMARY KEY,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('entrada','saida')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('venda','recebimento_venda','outra_receita','recebimento_emprestimo','juros_emprestimo','despesa','fornecedor','emprestimo_concedido','outra_saida')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  reference_type VARCHAR(30),
  reference_id INTEGER,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON cash_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_cash_movements_direction ON cash_movements(direction);
CREATE INDEX IF NOT EXISTS idx_cash_movements_category ON cash_movements(category);

-- Auditoria: somente inserção (nenhuma rota da API expõe UPDATE/DELETE nesta tabela).
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER,
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date ON audit_logs(created_at);
