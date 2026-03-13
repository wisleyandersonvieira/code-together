import { action } from '@uibakery/data';

function createProjectRelatedTables() {
  return action('createProjectRelatedTables', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Create orcamentos table
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

      -- Create conta_pagar_orcamento_alocacao table
      CREATE TABLE IF NOT EXISTS conta_pagar_orcamento_alocacao (
        id SERIAL PRIMARY KEY,
        conta_pagar_id INTEGER NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
        orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
        valor_alocado DECIMAL(15, 2) NOT NULL DEFAULT 0,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (conta_pagar_id, orcamento_id)
      );

      -- Create previsao_aportes table
      CREATE TABLE IF NOT EXISTS previsao_aportes (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
        membro_id INTEGER NOT NULL REFERENCES projeto_members(id) ON DELETE CASCADE,
        data_previsao DATE NOT NULL,
        valor_previsto DECIMAL(15,2) NOT NULL CHECK (valor_previsto >= 0),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (projeto_id, membro_id, data_previsao)
      );

      -- Create rateio_aportes table
      CREATE TABLE IF NOT EXISTS rateio_aportes (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
        aporte_id INTEGER NOT NULL REFERENCES previsao_aportes(id) ON DELETE CASCADE,
        valor_rateado NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conta_receber_id, aporte_id)
      );

      -- Create projeto_column_history table
      CREATE TABLE IF NOT EXISTS projeto_column_history (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
        to_column_id INTEGER NOT NULL REFERENCES kanban_columns(id) ON DELETE CASCADE,
        moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create projeto_comments table
      CREATE TABLE IF NOT EXISTS projeto_comments (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create projeto_tasks table
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

      -- Create contas_pagar_projetos table (linking contas_pagar to projects)
      CREATE TABLE IF NOT EXISTS contas_pagar_projetos (
        id SERIAL PRIMARY KEY,
        conta_pagar_id INTEGER NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
        projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
        valor_alocado DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conta_pagar_id, projeto_id)
      );

      -- Create contas_receber_projetos table (linking contas_receber to projects)
      CREATE TABLE IF NOT EXISTS contas_receber_projetos (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
        projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
        valor_alocado DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conta_receber_id, projeto_id)
      );

      -- Create orcamentos_executado view
      CREATE OR REPLACE VIEW orcamentos_executado AS
      SELECT 
        o.id,
        o.projeto_id,
        o.description,
        o.fornecedor_id,
        o.predicted_date,
        o.value as valor_orcado,
        COALESCE(SUM(cpoa.valor_alocado), 0) as valor_executado,
        (o.value - COALESCE(SUM(cpoa.valor_alocado), 0)) as valor_saldo
      FROM orcamentos o
      LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
      GROUP BY o.id, o.projeto_id, o.description, o.fornecedor_id, o.predicted_date, o.value;

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_conta_pagar_orcamento_conta_pagar ON conta_pagar_orcamento_alocacao(conta_pagar_id);
      CREATE INDEX IF NOT EXISTS idx_previsao_aportes_projeto ON previsao_aportes(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_rateio_aportes_conta_receber ON rateio_aportes(conta_receber_id);
      CREATE INDEX IF NOT EXISTS idx_projeto_column_history_projeto ON projeto_column_history(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_projeto_comments_projeto ON projeto_comments(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_projeto_tasks_projeto ON projeto_tasks(projeto_id);
      CREATE INDEX IF NOT EXISTS idx_contas_pagar_projetos_conta ON contas_pagar_projetos(conta_pagar_id);
      CREATE INDEX IF NOT EXISTS idx_contas_receber_projetos_conta ON contas_receber_projetos(conta_receber_id);

      SELECT 'Project related tables created successfully' as result;
    `,
  });
}

export default createProjectRelatedTables;
