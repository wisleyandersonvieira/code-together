import { action } from '@uibakery/data';

function createFinancialTables() {
  return action('createFinancialTables', 'SQL', {
    databaseName: 'provision',
    query: `
      CREATE TABLE IF NOT EXISTS contas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255),
        numero VARCHAR(100),
        banco VARCHAR(255),
        saldo_inicial NUMERIC(15,2),
        data_saldo_inicial DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        descricao TEXT,
        destaque BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS grupos_contabeis (
        id SERIAL PRIMARY KEY,
        descricao VARCHAR(255),
        tipo VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subgrupos_contabeis (
        id SERIAL PRIMARY KEY,
        descricao VARCHAR(255),
        grupo_id INTEGER,
        funcao VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100),
        descricao VARCHAR(255),
        tipo VARCHAR(100),
        grupo_id INTEGER,
        subgrupo_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tipos_documento (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(20),
        descricao VARCHAR(255),
        mascara VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parametros (
        id SERIAL PRIMARY KEY,
        chave VARCHAR(255),
        valor VARCHAR(500),
        descricao TEXT,
        tipo VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      SELECT 'Financial tables created successfully' as result;
    `,
  });
}

export default createFinancialTables;
