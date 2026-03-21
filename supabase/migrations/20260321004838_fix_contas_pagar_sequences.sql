-- Fix sequences for all contas_pagar related tables
-- Prevents duplicate key errors after data migration

SELECT setval('contas_pagar_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas_pagar), false);
SELECT setval('contas_pagar_itens_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas_pagar_itens), false);
SELECT setval('contas_pagar_projetos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas_pagar_projetos), false);
SELECT setval('titulos_pagar_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM titulos_pagar), false);
SELECT setval('conta_pagar_orcamento_alocacao_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM conta_pagar_orcamento_alocacao), false);
