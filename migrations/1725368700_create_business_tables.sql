-- Migration to create business management tables

-- Clientes table
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  cpf VARCHAR(14) UNIQUE,
  birth_date DATE,
  file_urls TEXT[], -- Store file URLs as array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Empresas table
CREATE TABLE empresas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  number VARCHAR(100),
  file_urls TEXT[], -- Store file URLs as array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Empresa Clientes relationship with percentage
CREATE TABLE empresa_clientes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grupos table
CREATE TABLE grupos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  file_urls TEXT[], -- Store file URLs as array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grupo members relationship with percentage
CREATE TABLE grupo_members (
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

-- Fornecedores table
CREATE TABLE fornecedores (
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

-- Projetos table
CREATE TABLE projetos (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(255),
  construction_sqft DECIMAL(10,2),
  land_sqft DECIMAL(10,2),
  details TEXT,
  predicted_sale_value DECIMAL(15,2),
  photo_urls TEXT[], -- Store photo URLs as array
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orçamentos table
CREATE TABLE orcamentos (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  predicted_date DATE,
  value DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_clientes_cpf ON clientes (cpf);
CREATE INDEX idx_clientes_email ON clientes (email);
CREATE INDEX idx_empresa_clientes_empresa ON empresa_clientes (empresa_id);
CREATE INDEX idx_empresa_clientes_cliente ON empresa_clientes (cliente_id);
CREATE INDEX idx_grupo_members_grupo ON grupo_members (grupo_id);
CREATE INDEX idx_grupo_members_cliente ON grupo_members (cliente_id);
CREATE INDEX idx_grupo_members_empresa ON grupo_members (empresa_id);
CREATE INDEX idx_orcamentos_projeto ON orcamentos (projeto_id);
CREATE INDEX idx_orcamentos_fornecedor ON orcamentos (fornecedor_id);
