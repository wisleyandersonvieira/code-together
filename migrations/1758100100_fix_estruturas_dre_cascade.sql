-- Migration to ensure CASCADE delete works for estruturas_dre_itens
-- Drop and recreate the foreign key constraint with CASCADE

ALTER TABLE estruturas_dre_itens 
DROP CONSTRAINT IF EXISTS estruturas_dre_itens_estrutura_dre_id_fkey;

ALTER TABLE estruturas_dre_itens 
ADD CONSTRAINT estruturas_dre_itens_estrutura_dre_id_fkey 
FOREIGN KEY (estrutura_dre_id) REFERENCES estruturas_dre(id) ON DELETE CASCADE;


