-- Migration to create transferencias table
CREATE TABLE transferencias (
  id SERIAL PRIMARY KEY,
  conta_origem_id INTEGER NOT NULL REFERENCES contas(id),
  conta_destino_id INTEGER NOT NULL REFERENCES contas(id),
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  data_transferencia DATE NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure origem != destino
  CONSTRAINT ck_contas_diferentes CHECK (conta_origem_id != conta_destino_id)
);

-- Create indexes for better performance
CREATE INDEX idx_transferencias_origem ON transferencias(conta_origem_id);
CREATE INDEX idx_transferencias_destino ON transferencias(conta_destino_id);
CREATE INDEX idx_transferencias_data ON transferencias(data_transferencia);
