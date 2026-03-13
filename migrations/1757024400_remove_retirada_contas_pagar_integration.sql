-- Remove automatic contas_pagar integration from retiradas
DROP TRIGGER IF EXISTS trigger_create_retirada_titulo_pagar ON retiradas;
DROP FUNCTION IF EXISTS create_retirada_titulo_pagar();

-- Clean up existing retirada entries from contas_pagar
DELETE FROM titulos_pagar 
WHERE conta_pagar_id IN (
  SELECT id FROM contas_pagar WHERE entity_type = 'retirada'
);

DELETE FROM contas_pagar WHERE entity_type = 'retirada';

-- Update entity_type constraint to remove retirada
ALTER TABLE contas_pagar 
DROP CONSTRAINT IF EXISTS contas_pagar_entity_type_check;

ALTER TABLE contas_pagar 
ADD CONSTRAINT contas_pagar_entity_type_check 
CHECK (entity_type IN ('fornecedor'));
