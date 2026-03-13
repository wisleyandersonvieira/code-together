-- Remove automatic contas_receber integration from aportes  
DROP TRIGGER IF EXISTS trigger_create_aporte_titulo_receber ON aportes;
DROP FUNCTION IF EXISTS create_aporte_titulo_receber();

-- Clean up existing aporte entries from contas_receber
DELETE FROM titulos_receber 
WHERE conta_receber_id IN (
  SELECT id FROM contas_receber WHERE entity_type = 'aporte'
);

DELETE FROM contas_receber WHERE entity_type = 'aporte';

-- Update any NULL entity_type values to 'cliente' before adding constraint
UPDATE contas_receber 
SET entity_type = 'cliente' 
WHERE entity_type IS NULL OR entity_type NOT IN ('cliente', 'aporte');

-- Drop and recreate constraint
DO $$ 
BEGIN
    -- Drop constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'contas_receber_entity_type_check' 
               AND table_name = 'contas_receber') THEN
        ALTER TABLE contas_receber DROP CONSTRAINT contas_receber_entity_type_check;
    END IF;
END $$;

-- Add new constraint that only allows 'cliente'
ALTER TABLE contas_receber 
ADD CONSTRAINT contas_receber_entity_type_check 
CHECK (entity_type IN ('cliente'));
