-- Fix file_data column to use TEXT instead of BYTEA for better compatibility
-- Drop the existing table if it exists and recreate with proper structure
DROP TABLE IF EXISTS files CASCADE;

CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_data TEXT NOT NULL, -- Store as base64 text instead of bytea
    entity_type VARCHAR(50) NOT NULL, -- 'projeto_photo', 'projeto_document', 'cliente', 'empresa', 'grupo'
    entity_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_files_entity ON files(entity_type, entity_id);
