-- Migration to create produtos table for produto/servico cadastro
CREATE TABLE produtos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Produto', 'Servico')),
    grupo_id INTEGER NOT NULL REFERENCES grupos_contabeis(id) ON DELETE RESTRICT,
    subgrupo_id INTEGER NOT NULL REFERENCES subgrupos_contabeis(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance  
CREATE INDEX idx_produtos_grupo_id ON produtos(grupo_id);
CREATE INDEX idx_produtos_subgrupo_id ON produtos(subgrupo_id);
CREATE INDEX idx_produtos_tipo ON produtos(tipo);
CREATE INDEX idx_produtos_descricao ON produtos(descricao);

-- Create sequence for codigo auto-generation
CREATE SEQUENCE produtos_codigo_seq START 1;
