-- Migration to add project members functionality

-- Projeto members relationship with percentage (similar to grupos)
CREATE TABLE projeto_members (
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

-- Index for performance
CREATE INDEX idx_projeto_members_projeto ON projeto_members (projeto_id);
CREATE INDEX idx_projeto_members_cliente ON projeto_members (cliente_id);
CREATE INDEX idx_projeto_members_empresa ON projeto_members (empresa_id);
CREATE INDEX idx_projeto_members_grupo ON projeto_members (grupo_id);
