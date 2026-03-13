-- Migration to fix CASCADE constraints for empresa_clientes and grupo_members
-- Remove existing constraints and recreate them with CASCADE

-- Fix empresa_clientes constraints
ALTER TABLE empresa_clientes 
DROP CONSTRAINT IF EXISTS empresa_clientes_empresa_id_fkey;

ALTER TABLE empresa_clientes 
DROP CONSTRAINT IF EXISTS empresa_clientes_cliente_id_fkey;

ALTER TABLE empresa_clientes 
ADD CONSTRAINT empresa_clientes_empresa_id_fkey 
FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

ALTER TABLE empresa_clientes 
ADD CONSTRAINT empresa_clientes_cliente_id_fkey 
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

-- Fix grupo_members constraints
ALTER TABLE grupo_members 
DROP CONSTRAINT IF EXISTS grupo_members_grupo_id_fkey;

ALTER TABLE grupo_members 
DROP CONSTRAINT IF EXISTS grupo_members_cliente_id_fkey;

ALTER TABLE grupo_members 
DROP CONSTRAINT IF EXISTS grupo_members_empresa_id_fkey;

ALTER TABLE grupo_members 
ADD CONSTRAINT grupo_members_grupo_id_fkey 
FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE;

ALTER TABLE grupo_members 
ADD CONSTRAINT grupo_members_cliente_id_fkey 
FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;

ALTER TABLE grupo_members 
ADD CONSTRAINT grupo_members_empresa_id_fkey 
FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

