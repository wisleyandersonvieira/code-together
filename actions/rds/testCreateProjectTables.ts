import { action } from '@uibakery/data';

function testCreateProjectTables() {
  return action('testCreateProjectTables', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Create orcamentos table first
      CREATE TABLE IF NOT EXISTS orcamentos (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        description TEXT NOT NULL,
        fornecedor_id INTEGER,
        predicted_date DATE,
        value DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create projeto_comments table
      CREATE TABLE IF NOT EXISTS projeto_comments (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        user_id INTEGER,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create projeto_tasks table
      CREATE TABLE IF NOT EXISTS projeto_tasks (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        task_name VARCHAR(255) NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        created_by INTEGER,
        completed_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL
      );

      -- Create projeto_column_history table
      CREATE TABLE IF NOT EXISTS projeto_column_history (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        user_id INTEGER,
        from_column_id INTEGER,
        to_column_id INTEGER,
        moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create basic linking tables
      CREATE TABLE IF NOT EXISTS contas_pagar_projetos (
        id SERIAL PRIMARY KEY,
        conta_pagar_id INTEGER,
        projeto_id INTEGER,
        valor_alocado DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contas_receber_projetos (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER,
        projeto_id INTEGER,
        valor_alocado DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create conta_pagar_orcamento_alocacao table
      CREATE TABLE IF NOT EXISTS conta_pagar_orcamento_alocacao (
        id SERIAL PRIMARY KEY,
        conta_pagar_id INTEGER,
        orcamento_id INTEGER,
        valor_alocado DECIMAL(15, 2) NOT NULL DEFAULT 0,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create previsao_aportes table (without projeto_members FK for now)
      CREATE TABLE IF NOT EXISTS previsao_aportes (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        membro_id INTEGER,
        data_previsao DATE NOT NULL,
        valor_previsto DECIMAL(15,2) NOT NULL,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create rateio_aportes table
      CREATE TABLE IF NOT EXISTS rateio_aportes (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER,
        aporte_id INTEGER,
        valor_rateado NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create view
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

      SELECT 'All project tables created successfully' as result;
    `,
  });
}

export default testCreateProjectTables;
