-- Migration to ensure produtos-related tables exist
CREATE TABLE IF NOT EXISTS grupos_contabeis (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Receita', 'Despesa', 'Investimento', 'Distribuição')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subgrupos_contabeis (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    grupo_id INTEGER NOT NULL REFERENCES grupos_contabeis(id) ON DELETE CASCADE,
    funcao VARCHAR(50) NOT NULL CHECK (funcao IN ('Crédito', 'Débito')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Produto', 'Servico')),
    grupo_id INTEGER REFERENCES grupos_contabeis(id) ON DELETE RESTRICT,
    subgrupo_id INTEGER REFERENCES subgrupos_contabeis(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_subgrupos_contabeis_grupo_id ON subgrupos_contabeis(grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupos_contabeis_tipo ON grupos_contabeis(tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_grupo_id ON produtos(grupo_id);
CREATE INDEX IF NOT EXISTS idx_produtos_subgrupo_id ON produtos(subgrupo_id);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_descricao ON produtos(descricao);

-- Create sequence if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'produtos_codigo_seq') THEN
        CREATE SEQUENCE produtos_codigo_seq START 1;
    END IF;
END
$$;

-- Insert some default grupos and subgrupos if they don't exist
INSERT INTO grupos_contabeis (descricao, tipo) 
SELECT 'Materiais e Suprimentos', 'Despesa' 
WHERE NOT EXISTS (SELECT 1 FROM grupos_contabeis WHERE descricao = 'Materiais e Suprimentos');

INSERT INTO grupos_contabeis (descricao, tipo) 
SELECT 'Serviços', 'Despesa' 
WHERE NOT EXISTS (SELECT 1 FROM grupos_contabeis WHERE descricao = 'Serviços');

INSERT INTO subgrupos_contabeis (descricao, grupo_id, funcao)
SELECT 'Materiais de Construção', g.id, 'Débito'
FROM grupos_contabeis g 
WHERE g.descricao = 'Materiais e Suprimentos'
AND NOT EXISTS (SELECT 1 FROM subgrupos_contabeis WHERE descricao = 'Materiais de Construção');

INSERT INTO subgrupos_contabeis (descricao, grupo_id, funcao)
SELECT 'Serviços Gerais', g.id, 'Débito'
FROM grupos_contabeis g 
WHERE g.descricao = 'Serviços'
AND NOT EXISTS (SELECT 1 FROM subgrupos_contabeis WHERE descricao = 'Serviços Gerais');

-- Insert some sample products if they don't exist
INSERT INTO produtos (codigo, descricao, tipo, grupo_id, subgrupo_id)
SELECT 'PROD001', 'Material de Construção Geral', 'Produto', g.id, s.id
FROM grupos_contabeis g, subgrupos_contabeis s
WHERE g.descricao = 'Materiais e Suprimentos' 
AND s.descricao = 'Materiais de Construção'
AND NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'PROD001');

INSERT INTO produtos (codigo, descricao, tipo, grupo_id, subgrupo_id)
SELECT 'SERV001', 'Serviços de Consultoria', 'Servico', g.id, s.id
FROM grupos_contabeis g, subgrupos_contabeis s
WHERE g.descricao = 'Serviços' 
AND s.descricao = 'Serviços Gerais'
AND NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'SERV001');
