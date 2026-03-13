-- Migration to create previsao_aportes table for project member contribution forecasts
CREATE TABLE previsao_aportes (
  id SERIAL PRIMARY KEY,
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  membro_id INTEGER NOT NULL REFERENCES projeto_members(id) ON DELETE CASCADE,
  data_previsao DATE NOT NULL,
  valor_previsto DECIMAL(15,2) NOT NULL CHECK (valor_previsto >= 0),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique combination of projeto, membro and date
  UNIQUE (projeto_id, membro_id, data_previsao)
);

-- Create indexes for better performance
CREATE INDEX idx_previsao_aportes_projeto ON previsao_aportes(projeto_id);
CREATE INDEX idx_previsao_aportes_membro ON previsao_aportes(membro_id);
CREATE INDEX idx_previsao_aportes_data ON previsao_aportes(data_previsao);
