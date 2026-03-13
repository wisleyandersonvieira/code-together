-- Migration to create parametros table
CREATE TABLE parametros (
  id SERIAL PRIMARY KEY,
  chave VARCHAR(100) UNIQUE NOT NULL,
  valor VARCHAR(500) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) DEFAULT 'texto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default currency parameter
INSERT INTO parametros (chave, valor, descricao, tipo) 
VALUES ('MOEDA', 'BRL', 'Moeda utilizada no sistema (BRL para Real, USD para Dólar)', 'opcao');

-- Create index for better performance
CREATE INDEX idx_parametros_chave ON parametros(chave);
