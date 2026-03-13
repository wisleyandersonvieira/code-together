import { action } from '@uibakery/data';

function createProjectTablesStep2() {
  return action('createProjectTablesStep2', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Step 2: Create tables that depend on projeto_members
      
      -- Create previsao_aportes table
      CREATE TABLE IF NOT EXISTS previsao_aportes (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        membro_id INTEGER,
        data_previsao DATE NOT NULL,
        valor_previsto DECIMAL(15,2) NOT NULL CHECK (valor_previsto >= 0),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

      -- Create rateio_aportes table
      CREATE TABLE IF NOT EXISTS rateio_aportes (
        id SERIAL PRIMARY KEY,
        conta_receber_id INTEGER,
        aporte_id INTEGER,
        valor_rateado NUMERIC(15,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      SELECT 'Step 2 project tables created successfully' as result;
    `,
  });
}

export default createProjectTablesStep2;
