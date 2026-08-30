-- Migration 001: fundação do banco (roles, users, categories, products, customers)
-- O que muda: cria as tabelas base de autenticação e cadastro.
-- Por que: são pré-requisito para todos os módulos seguintes (vendas, estoque, empréstimos).
-- Tabelas afetadas: roles, users, categories, products, customers (novas).
-- Impacto: nenhum, banco ainda não tem dados.
-- Como desfazer: rodar 001_init_down.sql (remove as tabelas na ordem inversa).

-- Função utilitária para manter "updated_at" sempre atualizado automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- ROLES (perfis de acesso)
-- =========================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE, -- 'admin' | 'funcionario'
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description)
VALUES
  ('admin', 'Acesso completo ao sistema'),
  ('funcionario', 'Acesso limitado: vendas, produtos e clientes')
ON CONFLICT (name) DO NOTHING;

-- =========================
-- USERS (usuários do sistema)
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- CATEGORIES (categorias de produto)
-- =========================
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (name) VALUES
  ('Perfumes'),
  ('Perfumes importados'),
  ('Perfumes nacionais'),
  ('Body Splash'),
  ('Hidratantes'),
  ('Desodorantes'),
  ('Cosméticos'),
  ('Maquiagem'),
  ('Acessórios'),
  ('Outros')
ON CONFLICT (name) DO NOTHING;

-- =========================
-- PRODUCTS (catálogo de produtos)
-- =========================
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(50) UNIQUE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  brand VARCHAR(100),
  product_type VARCHAR(100),
  description TEXT,
  supplier VARCHAR(150),
  barcode VARCHAR(50),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  cost NUMERIC(12,2) NOT NULL CHECK (cost >= 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  entry_date DATE,
  expiry_date DATE,
  image_url TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING GIN (to_tsvector('portuguese', name));

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- CUSTOMERS (clientes)
-- =========================
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  document VARCHAR(20) UNIQUE, -- CPF/CNPJ, opcional
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(150),
  address TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_document ON customers(document);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING GIN (to_tsvector('portuguese', name));

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
