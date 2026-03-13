-- Migration to create contas a pagar system
CREATE TABLE contas_pagar (
    id SERIAL PRIMARY KEY,
    fornecedor_id INTEGER NOT NULL,
    tipo_documento_id INTEGER NOT NULL,
    numero_documento VARCHAR(100) NOT NULL,
    data_emissao DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    data_competencia DATE NOT NULL,
    observacoes TEXT,
    valor_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, PAGO_PARCIAL, PAGO_TOTAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id),
    FOREIGN KEY (tipo_documento_id) REFERENCES tipos_documento(id)
);

CREATE TABLE contas_pagar_itens (
    id SERIAL PRIMARY KEY,
    conta_pagar_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade DECIMAL(15, 3) NOT NULL,
    valor_unitario DECIMAL(15, 2) NOT NULL,
    valor_total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE contas_pagar_projetos (
    id SERIAL PRIMARY KEY,
    conta_pagar_id INTEGER NOT NULL,
    projeto_id INTEGER NOT NULL,
    percentual DECIMAL(5, 2) NOT NULL, -- 0.01 to 100.00
    valor_rateio DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE,
    FOREIGN KEY (projeto_id) REFERENCES projetos(id)
);

CREATE TABLE titulos_pagar (
    id SERIAL PRIMARY KEY,
    conta_pagar_id INTEGER NOT NULL,
    parcela INTEGER NOT NULL,
    total_parcelas INTEGER NOT NULL,
    data_vencimento DATE NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    valor_pago DECIMAL(15, 2) DEFAULT 0,
    data_pagamento DATE,
    conta_id INTEGER,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- PENDENTE, PAGO
    observacoes_pagamento TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE,
    FOREIGN KEY (conta_id) REFERENCES contas(id)
);

-- Indexes for better performance
CREATE INDEX idx_contas_pagar_fornecedor ON contas_pagar(fornecedor_id);
CREATE INDEX idx_contas_pagar_tipo ON contas_pagar(tipo_documento_id);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar(data_vencimento);

CREATE INDEX idx_titulos_pagar_conta_pagar ON titulos_pagar(conta_pagar_id);
CREATE INDEX idx_titulos_pagar_vencimento ON titulos_pagar(data_vencimento);
CREATE INDEX idx_titulos_pagar_status ON titulos_pagar(status);

CREATE INDEX idx_contas_pagar_itens_conta ON contas_pagar_itens(conta_pagar_id);
CREATE INDEX idx_contas_pagar_projetos_conta ON contas_pagar_projetos(conta_pagar_id);
