-- Migration: add is_cover flag to files so a project photo can be marked as cover.
-- Idempotent: safe to run multiple times.

ALTER TABLE files
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT FALSE;

-- Speeds up the cover lookup used by the project cards listing. Non-unique on purpose:
-- a unique index would be checked per-row during the single multi-row UPDATE in
-- setProjetoCover and could raise a transient violation while swapping the cover.
-- Uniqueness (one cover per entity) is guaranteed by that UPDATE, which sets every
-- other row of the entity to false in the same statement.
CREATE INDEX IF NOT EXISTS idx_files_cover
  ON files (entity_type, entity_id)
  WHERE is_cover = TRUE;

COMMENT ON COLUMN files.is_cover IS 'Marca este arquivo como foto de capa da entidade (ex.: capa do projeto).';
