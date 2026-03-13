-- Migration to add active field to clientes table
ALTER TABLE clientes ADD COLUMN active BOOLEAN DEFAULT true NOT NULL;

-- Create index for active field for performance
CREATE INDEX idx_clientes_active ON clientes (active);

-- Update all existing clients to be active by default
UPDATE clientes SET active = true WHERE active IS NULL;
