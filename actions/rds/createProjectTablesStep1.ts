import { action } from '@uibakery/data';

function createProjectTablesStep1() {
  return action('createProjectTablesStep1', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Step 1: Create basic project tables without foreign key dependencies
      
      -- Create orcamentos table
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

      -- Create projeto_column_history table
      CREATE TABLE IF NOT EXISTS projeto_column_history (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        user_id INTEGER,
        from_column_id INTEGER,
        to_column_id INTEGER,
        moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

      SELECT 'Step 1 project tables created successfully' as result;
    `,
  });
}

export default createProjectTablesStep1;
