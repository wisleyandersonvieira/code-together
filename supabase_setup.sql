-- Script para criar tabelas no Supabase
-- Execute no SQL Editor do painel Supabase

-- 1. Usuários da aplicação
CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  encrypted_password VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires_at TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Colunas do Kanban
CREATE TABLE IF NOT EXISTS kanban_columns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(7) DEFAULT '#4F46E5',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  cpf VARCHAR(14) UNIQUE,
  birth_date DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Projetos
CREATE TABLE IF NOT EXISTS projetos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(255),
  construction_sqft DECIMAL(10,2),
  land_sqft DECIMAL(10,2),
  details TEXT,
  predicted_sale_value DECIMAL(15,2),
  status VARCHAR(50) DEFAULT 'ativo',
  kanban_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
  kanban_position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Inserir colunas padrão do Kanban
INSERT INTO kanban_columns (name, position, color) VALUES
('Novo', 1, '#3B82F6'),
('Em Andamento', 2, '#F59E0B'),
('Concluído', 3, '#10B981')
ON CONFLICT DO NOTHING;

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_projetos_kanban_column ON projetos(kanban_column_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);
CREATE INDEX IF NOT EXISTS idx_clientes_active ON clientes(active);

SELECT 'Setup concluído com sucesso!' as message;
