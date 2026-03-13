-- Migration to remove vinculo fields from contas table
ALTER TABLE contas DROP CONSTRAINT IF EXISTS contas_vinculo_check;
DROP INDEX IF EXISTS idx_contas_cliente_id;
DROP INDEX IF EXISTS idx_contas_empresa_id;
DROP INDEX IF EXISTS idx_contas_grupo_id;

ALTER TABLE contas DROP COLUMN IF EXISTS cliente_id;
ALTER TABLE contas DROP COLUMN IF EXISTS empresa_id;
ALTER TABLE contas DROP COLUMN IF EXISTS grupo_id;
