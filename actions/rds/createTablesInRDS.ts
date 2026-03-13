import { action } from '@uibakery/data';

function createTablesInRDS() {
  return action('createTablesInRDS', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Create all tables in RDS
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(255),
        role VARCHAR(100),
        status VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        password_hash VARCHAR(255),
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        last_login TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(255),
        role VARCHAR(100),
        status VARCHAR(100),
        encrypted_password VARCHAR(255),
        password_reset_token VARCHAR(255),
        password_reset_expires_at TIMESTAMP,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        address TEXT,
        phone VARCHAR(255),
        email VARCHAR(255),
        cpf VARCHAR(20),
        birth_date DATE,
        file_urls TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        number VARCHAR(100),
        file_urls TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS grupos (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        file_urls TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS fornecedores (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        address TEXT,
        phone VARCHAR(255),
        email VARCHAR(255),
        contact_name VARCHAR(255),
        contact_phone VARCHAR(255),
        ein_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      SELECT 'Tables created successfully' as result;
    `,
  });
}

export default createTablesInRDS;
