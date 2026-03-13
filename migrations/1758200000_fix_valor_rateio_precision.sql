-- Migration to ensure valor_rateio has proper decimal precision in contas_pagar_projetos and contas_receber_projetos
-- This migration will fix any existing data and ensure future data is stored correctly

-- Fix contas_pagar_projetos
ALTER TABLE contas_pagar_projetos 
  ALTER COLUMN valor_rateio TYPE NUMERIC(15,2);

-- Fix contas_receber_projetos (if the same issue exists)
ALTER TABLE contas_receber_projetos 
  ALTER COLUMN valor_rateio TYPE NUMERIC(15,2);

-- Also ensure percentual has proper precision
ALTER TABLE contas_pagar_projetos 
  ALTER COLUMN percentual TYPE NUMERIC(5,2);

ALTER TABLE contas_receber_projetos 
  ALTER COLUMN percentual TYPE NUMERIC(5,2);

-- Fix contas_receber_faturamento valor_faturamento precision
ALTER TABLE contas_receber_faturamento
  ALTER COLUMN valor_faturamento TYPE NUMERIC(15,2);
