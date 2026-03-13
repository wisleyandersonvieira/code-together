import { action } from '@uibakery/data';

function createMissingLinkTables() {
  return action('createMissingLinkTables', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Create empresa_clientes table
      CREATE TABLE IF NOT EXISTS empresa_clientes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        cliente_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create grupo_members table  
      CREATE TABLE IF NOT EXISTS grupo_members (
        id SERIAL PRIMARY KEY,
        grupo_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(100) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create kanban_columns table
      CREATE TABLE IF NOT EXISTS kanban_columns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ordem INTEGER,
        color VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      SELECT 'Missing link tables created successfully' as result;
    `,
  });
}

export default createMissingLinkTables;
