-- Criar tabela de sócios
CREATE TABLE socios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(100),
    cpf VARCHAR(14),
    data_nascimento DATE,
    endereco TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de matrizes
CREATE TABLE matrizes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj_ein VARCHAR(50),
    endereco TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de relacionamento matriz-sócios
CREATE TABLE matriz_socios (
    id SERIAL PRIMARY KEY,
    matriz_id INTEGER NOT NULL REFERENCES matrizes(id) ON DELETE CASCADE,
    socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
    percentual_participacao NUMERIC(5,2) NOT NULL CHECK (percentual_participacao > 0 AND percentual_participacao <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(matriz_id, socio_id)
);

-- Criar índices para melhor performance
CREATE INDEX idx_socios_nome ON socios(nome);
CREATE INDEX idx_socios_cpf ON socios(cpf);
CREATE INDEX idx_matrizes_nome ON matrizes(nome);
CREATE INDEX idx_matriz_socios_matriz_id ON matriz_socios(matriz_id);
CREATE INDEX idx_matriz_socios_socio_id ON matriz_socios(socio_id);
