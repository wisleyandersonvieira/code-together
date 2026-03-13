-- Migration to create contas (bank accounts) table
CREATE TABLE contas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    numero VARCHAR(50) NOT NULL,
    banco VARCHAR(255) NOT NULL,
    saldo_inicial DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    data_saldo_inicial DATE NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
    grupo_id INTEGER REFERENCES grupos(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT contas_vinculo_check CHECK (
        (cliente_id IS NOT NULL AND empresa_id IS NULL AND grupo_id IS NULL) OR
        (cliente_id IS NULL AND empresa_id IS NOT NULL AND grupo_id IS NULL) OR
        (cliente_id IS NULL AND empresa_id IS NULL AND grupo_id IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX idx_contas_cliente_id ON contas(cliente_id);
CREATE INDEX idx_contas_empresa_id ON contas(empresa_id);
CREATE INDEX idx_contas_grupo_id ON contas(grupo_id);
CREATE INDEX idx_contas_numero ON contas(numero);
