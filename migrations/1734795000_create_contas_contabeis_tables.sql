-- Migration to create grupos_contabeis and subgrupos_contabeis tables
CREATE TABLE grupos_contabeis (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Receita', 'Despesa', 'Investimento', 'Distribuição')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subgrupos_contabeis (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    grupo_id INTEGER NOT NULL REFERENCES grupos_contabeis(id) ON DELETE CASCADE,
    funcao VARCHAR(50) NOT NULL CHECK (funcao IN ('Crédito', 'Débito')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_subgrupos_contabeis_grupo_id ON subgrupos_contabeis(grupo_id);
CREATE INDEX idx_grupos_contabeis_tipo ON grupos_contabeis(tipo);
