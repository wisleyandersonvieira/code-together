-- Migration to create budget allocation system for contas a pagar
CREATE TABLE conta_pagar_orcamento_alocacao (
    id SERIAL PRIMARY KEY,
    conta_pagar_id INTEGER NOT NULL,
    orcamento_id INTEGER NOT NULL,
    valor_alocado DECIMAL(15, 2) NOT NULL DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conta_pagar_id) REFERENCES contas_pagar(id) ON DELETE CASCADE,
    FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
    UNIQUE (conta_pagar_id, orcamento_id)
);

-- Index for better performance
CREATE INDEX idx_conta_pagar_orcamento_conta_pagar ON conta_pagar_orcamento_alocacao(conta_pagar_id);
CREATE INDEX idx_conta_pagar_orcamento_orcamento ON conta_pagar_orcamento_alocacao(orcamento_id);

-- Add function to calculate total executed budget per project
CREATE OR REPLACE VIEW orcamentos_executado AS
SELECT 
    o.id,
    o.projeto_id,
    o.description,
    o.fornecedor_id,
    o.predicted_date,
    o.value as valor_orcado,
    COALESCE(SUM(cpoa.valor_alocado), 0) as valor_executado,
    (o.value - COALESCE(SUM(cpoa.valor_alocado), 0)) as valor_saldo
FROM orcamentos o
LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
GROUP BY o.id, o.projeto_id, o.description, o.fornecedor_id, o.predicted_date, o.value;
