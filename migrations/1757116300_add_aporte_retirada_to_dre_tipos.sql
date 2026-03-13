-- Add APORTE and RETIRADA types to DRE structure items
ALTER TABLE estruturas_dre_itens 
DROP CONSTRAINT estruturas_dre_itens_tipo_check;

ALTER TABLE estruturas_dre_itens 
ADD CONSTRAINT estruturas_dre_itens_tipo_check 
CHECK (tipo IN ('GRUPO', 'SUBGRUPO', 'SOMA', 'APORTE', 'RETIRADA'));
