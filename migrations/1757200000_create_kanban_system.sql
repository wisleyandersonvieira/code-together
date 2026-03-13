-- Criar tabela para colunas do kanban
CREATE TABLE IF NOT EXISTS kanban_columns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(7) DEFAULT '#4F46E5',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(position)
);

-- Atualizar projetos para incluir informação de coluna do kanban
ALTER TABLE projetos 
ADD COLUMN IF NOT EXISTS kanban_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS kanban_position INTEGER DEFAULT 0;

-- Criar tabela para comentários de projetos
CREATE TABLE IF NOT EXISTS projeto_comments (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela para histórico de movimentação entre colunas
CREATE TABLE IF NOT EXISTS projeto_column_history (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
  to_column_id INTEGER NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
  moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela para tarefas dos projetos
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

-- Inserir colunas padrão do kanban
INSERT INTO kanban_columns (name, position, color) VALUES 
  ('To Do', 1, '#6B7280'),
  ('Em Progresso', 2, '#3B82F6'),
  ('Concluído', 3, '#10B981')
ON CONFLICT (position) DO NOTHING;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_projetos_kanban_column ON projetos(kanban_column_id);
CREATE INDEX IF NOT EXISTS idx_projeto_comments_projeto ON projeto_comments(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tasks_projeto ON projeto_tasks(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_column_history_projeto ON projeto_column_history(projeto_id);
