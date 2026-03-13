import { action } from '@uibakery/data';

function applySupabaseStructure() {
  return action('applySupabaseStructure', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- Aplicar estrutura básica no Supabase
      -- Criar tabelas principais para a aplicação
      
      -- Tabela de usuários da aplicação (separada do auth.users do Supabase)
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Clientes
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        cpf VARCHAR(14) UNIQUE,
        birth_date DATE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Colunas do Kanban
      CREATE TABLE IF NOT EXISTS kanban_columns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        color VARCHAR(7) DEFAULT '#4F46E5',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Projetos  
      CREATE TABLE IF NOT EXISTS projetos (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        city VARCHAR(255),
        construction_sqft DECIMAL(10,2),
        land_sqft DECIMAL(10,2),
        details TEXT,
        predicted_sale_value DECIMAL(15,2),
        status VARCHAR(50) DEFAULT 'ativo',
        kanban_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE SET NULL,
        kanban_position INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      SELECT 'Estrutura básica criada com sucesso!' as status,
             CURRENT_TIMESTAMP as executed_at;
    `,
  });
}

export default applySupabaseStructure;
