-- Update entity_type check constraint to include 'aporte'
ALTER TABLE contas_receber 
DROP CONSTRAINT IF EXISTS contas_receber_entity_type_check;

ALTER TABLE contas_receber 
ADD CONSTRAINT contas_receber_entity_type_check 
CHECK (entity_type IN ('cliente', 'empresa', 'grupo', 'aporte'));
