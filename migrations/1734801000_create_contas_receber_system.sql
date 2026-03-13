-- Migration to create contas a receber system
CREATE TABLE contas_receber (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    tipo_documento_id INTEGER NOT NULL,
    numero_documento VARCHAR(100) NOT NULL,
    data_emissao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    data_competencia DATE NOT NULL,
    observacoes TEXT,
    valor_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, RECEBIDO_PARCIAL, RECEBIDO_TOTAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento(id)
);

CREATE TABLE contas_receber_itens (
    id SERIAL PRIMARY KEY,
    conta_receber_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade DECIMAL(15, 3) NOT NULL,
    valor_unitario DECIMAL(15, 2) NOT NULL,
    valor_total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_receber_id) REFERENCES contas_receber(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE contas_receber_projetos (
    id SERIAL PRIMARY KEY,
    conta_receber_id INTEGER NOT NULL,
    projeto_id INTEGER NOT NULL,
    percentual DECIMAL(5, 2) NOT NULL, -- 0.01 to 100.00
    valor_rateio DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_receber_id) REFERENCES contas_receber(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id)
);

CREATE TABLE titulos_receber (
    id SERIAL PRIMARY KEY,
    conta_receber_id INTEGER NOT NULL,
    parcela INTEGER NOT NULL,
    total_parcelas INTEGER NOT NULL,
    data_vencimento DATE NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    valor_recebido DECIMAL(15, 2) DEFAULT 0,
    data_recebimento DATE,
    conta_id INTEGER,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, RECEBIDO
    observacoes_recebimento TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_receber_id) REFERENCES contas_receber(id) ON DELETE CASCADE,
    FOREIGN KEY (conta_id) REFERENCES contas(id)
);

-- Indexes for better performance
CREATE INDEX idx_contas_receber_cliente ON contas_receber(cliente_id);
CREATE INDEX idx_contas_receber_tipo ON contas_receber(tipo_documento_id);
CREATE INDEX idx_contas_receber_status ON contas_receber(status);
CREATE INDEX idx_contas_receber_vencimento ON contas_receber(data_vencimento);

CREATE INDEX idx_titulos_receber_conta_receber ON titulos_receber(conta_receber_id);
CREATE INDEX idx_titulos_receber_vencimento ON titulos_receber(data_vencimento);
CREATE INDEX idx_titulos_receber_status ON titulos_receber(status);

CREATE INDEX idx_contas_receber_itens_conta ON contas_receber_itens(conta_receber_id);
CREATE INDEX idx_contas_receber_projetos_conta ON contas_receber_projetos(conta_receber_id);
