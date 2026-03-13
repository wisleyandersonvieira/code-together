-- Complete migration to Supabase
-- This creates the entire database structure for the Sistema de Gestão Empresarial

-- ============================================
-- USERS AND AUTHENTICATION
-- ============================================

CREATE TABLE IF NOT EXISTS users (
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

-- ============================================
-- BUSINESS ENTITIES
-- ============================================

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  cpf VARCHAR(14) UNIQUE,
  birth_date DATE,
  file_urls TEXT[],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  number VARCHAR(100),
  file_urls TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS empresa_clientes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grupos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  file_urls TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grupo_members (
  id SERIAL PRIMARY KEY,
  grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_only_one_member CHECK (
    (cliente_id IS NOT NULL AND empresa_id IS NULL) OR
    (cliente_id IS NULL AND empresa_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  ein_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- KANBAN SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS kanban_columns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(7) DEFAULT '#4F46E5',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(position)
);

-- ============================================
-- PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS projetos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(255),
  construction_sqft DECIMAL(10,2),
  land_sqft DECIMAL(10,2),
  details TEXT,
  predicted_sale_value DECIMAL(15,2),
  photo_urls TEXT[],
  document_urls TEXT[],
  status VARCHAR(50) DEFAULT 'ativo',
  kanban_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
  kanban_position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  predicted_date DATE,
  value DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projeto_members (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  grupo_id INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_only_one_project_member CHECK (
    (cliente_id IS NOT NULL AND empresa_id IS NULL AND grupo_id IS NULL) OR
    (cliente_id IS NULL AND empresa_id IS NOT NULL AND grupo_id IS NULL) OR
    (cliente_id IS NULL AND empresa_id IS NULL AND grupo_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS projeto_comments (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projeto_column_history (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
  to_column_id INTEGER NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
  moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projeto_tasks (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

-- ============================================
-- ACCOUNTING STRUCTURE
-- ============================================

CREATE TABLE IF NOT EXISTS grupos_contabeis (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Receita', 'Despesa', 'Investimento', 'Distribuição')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subgrupos_contabeis (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    grupo_id INTEGER NOT NULL REFERENCES grupos_contabeis(id) ON DELETE CASCADE,
    funcao VARCHAR(50) NOT NULL CHECK (funcao IN ('Crédito', 'Débito')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tipos_documento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    mascara VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Produto', 'Servico')),
    grupo_id INTEGER NOT NULL REFERENCES grupos_contabeis(id) ON DELETE RESTRICT,
    subgrupo_id INTEGER NOT NULL REFERENCES subgrupos_contabeis(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SYSTEM PARAMETERS
-- ============================================

CREATE TABLE IF NOT EXISTS parametros (
  id SERIAL PRIMARY KEY,
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor VARCHAR(500) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) DEFAULT 'texto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default kanban columns
INSERT INTO kanban_columns (name, position, color) 
SELECT 'To Do', 1, '#6B7280' WHERE NOT EXISTS (SELECT 1 FROM kanban_columns WHERE name = 'To Do');

INSERT INTO kanban_columns (name, position, color) 
SELECT 'Em Progresso', 2, '#3B82F6' WHERE NOT EXISTS (SELECT 1 FROM kanban_columns WHERE name = 'Em Progresso');

INSERT INTO kanban_columns (name, position, color) 
SELECT 'Concluído', 3, '#10B981' WHERE NOT EXISTS (SELECT 1 FROM kanban_columns WHERE name = 'Concluído');

-- Insert default parameters
INSERT INTO parametros (chave, valor, descricao, tipo) 
SELECT 'MOEDA', 'BRL', 'Moeda utilizada no sistema', 'opcao' 
WHERE NOT EXISTS (SELECT 1 FROM parametros WHERE chave = 'MOEDA');

-- Insert default document type  
INSERT INTO tipos_documento (codigo, descricao, mascara)
SELECT '001', 'Documento Padrão', '###########'
WHERE NOT EXISTS (SELECT 1 FROM tipos_documento WHERE codigo = '001');

-- Insert default accounting groups
INSERT INTO grupos_contabeis (descricao, tipo) 
SELECT 'Receitas Operacionais', 'Receita' WHERE NOT EXISTS (SELECT 1 FROM grupos_contabeis WHERE descricao = 'Receitas Operacionais');

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes (cpf);
CREATE INDEX IF NOT EXISTS idx_projetos_kanban_column ON projetos(kanban_column_id);
CREATE INDEX IF NOT EXISTS idx_projeto_comments_projeto ON projeto_comments(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tasks_projeto ON projeto_tasks(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_column_history_projeto ON projeto_column_history(projeto_id);
