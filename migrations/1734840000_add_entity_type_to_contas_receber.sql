-- Add entity type and ID fields to contas_receber table
ALTER TABLE contas_receber 
ADD COLUMN entity_type VARCHAR(20) DEFAULT 'cliente' CHECK (entity_type IN ('cliente', 'empresa', 'grupo')),
ADD COLUMN entity_id INTEGER;

-- Update existing records to use the new structure
UPDATE contas_receber 
SET entity_type = 'cliente', entity_id = cliente_id
WHERE cliente_id IS NOT NULL;

-- Make entity_id not null after migration
ALTER TABLE contas_receber 
ALTER COLUMN entity_id SET NOT NULL;

-- Update the foreign key constraints
-- Note: We can't add foreign key constraints that reference multiple tables
-- but we'll handle this at the application level
