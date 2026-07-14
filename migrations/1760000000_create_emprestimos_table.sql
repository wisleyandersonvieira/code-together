-- Migration to create emprestimos table (empréstimos e pagamentos de empréstimo)
-- Regra de negócio:
--   EMPRESTIMO -> SAÍDA de dinheiro da conta (valor negativo no extrato/saldo)
--   PAGAMENTO  -> ENTRADA de dinheiro na conta (valor positivo no extrato/saldo)
CREATE TABLE emprestimos (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('EMPRESTIMO', 'PAGAMENTO')),
  socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  matriz_id INTEGER NOT NULL REFERENCES matrizes(id) ON DELETE CASCADE,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  data_emprestimo DATE NOT NULL,
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emprestimos_conta_data ON emprestimos(conta_id, data_emprestimo);
CREATE INDEX idx_emprestimos_matriz ON emprestimos(matriz_id);
CREATE INDEX idx_emprestimos_socio ON emprestimos(socio_id);

-- Estrutura DRE: liberar os novos tipos de item para EMPRÉSTIMO ENTRADA / SAÍDA
ALTER TABLE estruturas_dre_itens
DROP CONSTRAINT IF EXISTS estruturas_dre_itens_tipo_check;

ALTER TABLE estruturas_dre_itens
ADD CONSTRAINT estruturas_dre_itens_tipo_check
CHECK (tipo IN ('GRUPO', 'SUBGRUPO', 'SOMA', 'APORTE', 'RETIRADA', 'EMPRESTIMO_ENTRADA', 'EMPRESTIMO_SAIDA'));
