-- Migration to add matriz_id field to contas_pagar and contas_receber tables
ALTER TABLE contas_pagar 
ADD COLUMN matriz_id INTEGER REFERENCES matrizes(id);

ALTER TABLE contas_receber 
ADD COLUMN matriz_id INTEGER REFERENCES matrizes(id);

-- Add indexes for performance
CREATE INDEX idx_contas_pagar_matriz_id ON contas_pagar(matriz_id);
CREATE INDEX idx_contas_receber_matriz_id ON contas_receber(matriz_id);
