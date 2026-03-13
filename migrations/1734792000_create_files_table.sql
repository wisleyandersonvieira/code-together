-- Create files table for proper file storage
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data BYTEA NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'projeto_photo', 'projeto_document', 'cliente', 'empresa', 'grupo'
    entity_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_files_entity ON files(entity_type, entity_id);

-- Add proper document_urls column if it doesn't exist
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS document_urls TEXT[];
