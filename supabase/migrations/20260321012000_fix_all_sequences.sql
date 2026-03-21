-- Fix sequences for ALL tables after data migration
-- Prevents duplicate key errors when inserting new records

SELECT setval('projetos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM projetos), false);
SELECT setval('clientes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM clientes), false);
SELECT setval('empresas_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM empresas), false);
SELECT setval('empresa_clientes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM empresa_clientes), false);
SELECT setval('grupos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM grupos), false);
SELECT setval('grupo_members_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM grupo_members), false);
SELECT setval('fornecedores_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM fornecedores), false);
SELECT setval('orcamentos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM orcamentos), false);
SELECT setval('projeto_members_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM projeto_members), false);
SELECT setval('matrizes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM matrizes), false);
SELECT setval('matriz_socios_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM matriz_socios), false);
SELECT setval('socios_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM socios), false);
SELECT setval('produtos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM produtos), false);
SELECT setval('tipos_documento_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM tipos_documento), false);
SELECT setval('contas_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas), false);
SELECT setval('transferencias_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM transferencias), false);
SELECT setval('aportes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM aportes), false);
SELECT setval('rateio_aportes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM rateio_aportes), false);
SELECT setval('retiradas_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM retiradas), false);
SELECT setval('previsao_aportes_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM previsao_aportes), false);
SELECT setval('files_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM files), false);
SELECT setval('parametros_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM parametros), false);
SELECT setval('grupos_contabeis_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM grupos_contabeis), false);
SELECT setval('subgrupos_contabeis_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM subgrupos_contabeis), false);
SELECT setval('estruturas_dre_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM estruturas_dre), false);
SELECT setval('estruturas_dre_itens_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM estruturas_dre_itens), false);
SELECT setval('estruturas_dre_soma_itens_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM estruturas_dre_soma_itens), false);
SELECT setval('contas_receber_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas_receber), false);
SELECT setval('contas_receber_itens_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas_receber_itens), false);
SELECT setval('contas_receber_projetos_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM contas_receber_projetos), false);
SELECT setval('titulos_receber_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM titulos_receber), false);
