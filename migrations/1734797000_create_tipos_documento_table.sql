-- Migration to create tipos_documento table
CREATE TABLE tipos_documento (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    mascara VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance  
CREATE INDEX idx_tipos_documento_descricao ON tipos_documento(descricao);

-- Create sequence for codigo auto-generation
CREATE SEQUENCE tipos_documento_codigo_seq START 1;
