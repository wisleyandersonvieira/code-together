import { action } from '@uibakery/data';

function createProjectTables() {
  return action('createProjectTables', 'SQL', {
    databaseName: 'provision',
    query: `
      CREATE TABLE IF NOT EXISTS projetos (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        address TEXT,
        city VARCHAR(255),
        construction_sqft NUMERIC(10,2),
        land_sqft NUMERIC(10,2),
        details TEXT,
        predicted_sale_value NUMERIC(15,2),
        photo_urls TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        document_urls TEXT[],
        status VARCHAR(100),
        kanban_column_id INTEGER,
        kanban_position INTEGER
      );

      CREATE TABLE IF NOT EXISTS kanban_columns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        position INTEGER,
        color VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS empresa_clientes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER,
        cliente_id INTEGER,
        percentage NUMERIC(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS grupo_members (
        id SERIAL PRIMARY KEY,
        grupo_id INTEGER,
        cliente_id INTEGER,
        empresa_id INTEGER,
        percentage NUMERIC(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projeto_members (
        id SERIAL PRIMARY KEY,
        projeto_id INTEGER,
        cliente_id INTEGER,
        empresa_id INTEGER,
        grupo_id INTEGER,
        percentage NUMERIC(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      SELECT 'Project tables created successfully' as result;
    `,
  });
}

export default createProjectTables;
