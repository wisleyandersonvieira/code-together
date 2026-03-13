CREATE OR REPLACE VIEW orcamentos_executado AS
SELECT 
    o.id,
    o.projeto_id,
    o.description,
    o.fornecedor_id,
    o.predicted_date,
    o.value as valor_orcado,
    COALESCE(SUM(cpoa.valor_alocado), 0) as valor_executado,
    (o.value - COALESCE(SUM(cpoa.valor_alocado), 0)) as valor_saldo
FROM orcamentos o
LEFT JOIN conta_pagar_orcamento_alocacao cpoa ON o.id = cpoa.orcamento_id
GROUP BY o.id, o.projeto_id, o.description, o.fornecedor_id, o.predicted_date, o.value;