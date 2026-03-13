-- Migration to create aportes table for financial contributions tracking
CREATE TABLE aportes (
  id SERIAL PRIMARY KEY,
  socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  matriz_id INTEGER NOT NULL REFERENCES matrizes(id) ON DELETE CASCADE,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  data_aporte DATE NOT NULL,
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_aportes_socio ON aportes(socio_id);
CREATE INDEX idx_aportes_matriz ON aportes(matriz_id);  
CREATE INDEX idx_aportes_conta ON aportes(conta_id);
CREATE INDEX idx_aportes_data ON aportes(data_aporte);

-- Trigger to automatically create credit entry in titulos_receber
CREATE OR REPLACE FUNCTION create_aporte_titulo_receber()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into contas_receber
    INSERT INTO contas_receber (
        cliente_id, 
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
        NULL, -- cliente_id is null for aporte
        'aporte',
        NEW.id,
        NEW.matriz_id,
        1, -- Default document type
        'APORTE-' || NEW.id,
        NEW.data_aporte,
        NEW.data_aporte,
        NEW.data_aporte,
        NEW.valor,
        'pendente',
        'Aporte automático - ' || COALESCE(NEW.observacoes, '')
    );
    
    -- Create titulo_receber and immediately receive it
    INSERT INTO titulos_receber (
        conta_receber_id,
        parcela,
        total_parcelas,
        data_vencimento,
        valor,
        valor_recebido,
        data_recebimento,
        conta_id,
        status,
        observacoes_recebimento
    ) 
    SELECT 
        cr.id,
        1,
        1,
        NEW.data_aporte,
        NEW.valor,
        NEW.valor,
        NEW.data_aporte,
        NEW.conta_id,
        'recebido',
        'Aporte recebido automaticamente'
    FROM contas_receber cr 
    WHERE cr.entity_type = 'aporte' AND cr.entity_id = NEW.id;
    
    -- Update contas_receber status to recebido
    UPDATE contas_receber 
    SET status = 'recebido' 
    WHERE entity_type = 'aporte' AND entity_id = NEW.id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_aporte_titulo_receber
    AFTER INSERT ON aportes
    FOR EACH ROW EXECUTE FUNCTION create_aporte_titulo_receber();
