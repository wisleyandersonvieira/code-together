-- Migration to create retiradas table for financial withdrawals tracking
CREATE TABLE retiradas (
  id SERIAL PRIMARY KEY,
  socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  matriz_id INTEGER NOT NULL REFERENCES matrizes(id) ON DELETE CASCADE,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  data_retirada DATE NOT NULL,
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_retiradas_socio ON retiradas(socio_id);
CREATE INDEX idx_retiradas_matriz ON retiradas(matriz_id);  
CREATE INDEX idx_retiradas_conta ON retiradas(conta_id);
CREATE INDEX idx_retiradas_data ON retiradas(data_retirada);

-- Update entity_type constraint in contas_pagar to include 'retirada'
ALTER TABLE contas_pagar 
DROP CONSTRAINT IF EXISTS contas_pagar_entity_type_check;

-- Add entity_type and entity_id columns to contas_pagar if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas_pagar' AND column_name='entity_type') THEN
        ALTER TABLE contas_pagar ADD COLUMN entity_type VARCHAR(20) DEFAULT 'fornecedor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas_pagar' AND column_name='entity_id') THEN
        ALTER TABLE contas_pagar ADD COLUMN entity_id INTEGER;
    END IF;
END $$;

-- Add constraint for entity_type including retirada
ALTER TABLE contas_pagar 
ADD CONSTRAINT contas_pagar_entity_type_check 
CHECK (entity_type IN ('fornecedor', 'retirada'));

-- Trigger to automatically create debit entry in contas_pagar
CREATE OR REPLACE FUNCTION create_retirada_titulo_pagar()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into contas_pagar with socio_id as fornecedor_id
    INSERT INTO contas_pagar (
        fornecedor_id, 
        entity_type,
        entity_id,
        matriz_id,
        tipo_documento_id,
        numero_documento,
        data_emissao,
        data_vencimento,
        data_competencia,
        valor_total,
        status,
        observacoes
    ) VALUES (
        NEW.socio_id, -- Use socio_id as fornecedor_id for retirada
        'retirada',
        NEW.id,
        NEW.matriz_id,
        1, -- Default document type
        'RETIRADA-' || NEW.id,
        NEW.data_retirada,
        NEW.data_retirada,
        NEW.data_retirada,
        NEW.valor,
        'PENDENTE',
        'Retirada automática - ' || COALESCE(NEW.observacoes, '')
    );
    
    -- Create titulo_pagar and immediately pay it
    INSERT INTO titulos_pagar (
        conta_pagar_id,
        parcela,
        total_parcelas,
        data_vencimento,
        valor,
        valor_pago,
        data_pagamento,
        conta_id,
        status,
        observacoes_pagamento
    ) 
    SELECT 
        cp.id,
        1,
        1,
        NEW.data_retirada,
        NEW.valor,
        NEW.valor,
        NEW.data_retirada,
        NEW.conta_id,
        'PAGO',
        'Retirada paga automaticamente'
    FROM contas_pagar cp 
    WHERE cp.entity_type = 'retirada' AND cp.entity_id = NEW.id;
    
    -- Update contas_pagar status to PAGO_TOTAL
    UPDATE contas_pagar 
    SET status = 'PAGO_TOTAL' 
    WHERE entity_type = 'retirada' AND entity_id = NEW.id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_retirada_titulo_pagar
    AFTER INSERT ON retiradas
    FOR EACH ROW EXECUTE FUNCTION create_retirada_titulo_pagar();
