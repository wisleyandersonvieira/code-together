-- Migration to add destaque field to contas table
ALTER TABLE contas 
ADD COLUMN destaque BOOLEAN DEFAULT FALSE;

-- Create index for better performance when querying highlighted accounts
CREATE INDEX idx_contas_destaque ON contas (destaque) WHERE destaque = TRUE;

-- Update existing accounts to have default destaque value
UPDATE contas SET destaque = FALSE WHERE destaque IS NULL;
