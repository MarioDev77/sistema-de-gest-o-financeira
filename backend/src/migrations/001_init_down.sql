-- Desfaz a migration 001_init.sql (ordem inversa por causa das Foreign Keys)
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP FUNCTION IF EXISTS set_updated_at();
