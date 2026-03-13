-- Migration to create contas_receber_faturamento table
CREATE TABLE
  contas_receber_faturamento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_receber_id BIGINT NOT NULL,
    projeto_id BIGINT NOT NULL,
    valor_faturamento NUMERIC(15, 2) NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
  );

CREATE INDEX idx_contas_receber_faturamento_conta_receber ON contas_receber_faturamento (conta_receber_id);
CREATE INDEX idx_contas_receber_faturamento_projeto ON contas_receber_faturamento (projeto_id);

-- Add foreign key constraints
ALTER TABLE contas_receber_faturamento 
  ADD CONSTRAINT fk_contas_receber_faturamento_conta_receber 
  FOREIGN KEY (conta_receber_id) REFERENCES contas_receber (id) ON DELETE CASCADE;

ALTER TABLE contas_receber_faturamento 
  ADD CONSTRAINT fk_contas_receber_faturamento_projeto 
  FOREIGN KEY (projeto_id) REFERENCES projetos (id) ON DELETE CASCADE;
