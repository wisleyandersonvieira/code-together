-- Migration to add status field to projetos table
ALTER TABLE projetos
ADD COLUMN status VARCHAR(20) DEFAULT 'Em andamento' NOT NULL;

-- Add check constraint to ensure only valid status values
ALTER TABLE projetos
ADD CONSTRAINT check_projeto_status 
CHECK (status IN ('Em andamento', 'Concluído'));

-- Add comment for documentation
COMMENT ON COLUMN projetos.status IS 'Status do projeto: Em andamento ou Concluído';
