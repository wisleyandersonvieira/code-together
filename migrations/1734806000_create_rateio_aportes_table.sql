-- Migration: Create table for storing rateio de aportes data
-- Description: Creates the rateio_aportes table to persist allocation data from contas a receber

CREATE TABLE rateio_aportes (
    id SERIAL PRIMARY KEY,
    conta_receber_id INTEGER NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
    aporte_id INTEGER NOT NULL REFERENCES previsao_aportes(id) ON DELETE CASCADE,
    valor_rateado NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique allocation per account and aporte
    UNIQUE(conta_receber_id, aporte_id)
);

-- Add index for faster lookups
CREATE INDEX idx_rateio_aportes_conta_receber_id ON rateio_aportes(conta_receber_id);
CREATE INDEX idx_rateio_aportes_aporte_id ON rateio_aportes(aporte_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rateio_aportes_updated_at 
    BEFORE UPDATE ON rateio_aportes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
