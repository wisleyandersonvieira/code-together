-- Indexes to support the Contas a Pagar / Contas a Receber listing queries.
--
-- The listing actions were rewritten to select the paginated page of IDs first
-- (ORDER BY data_vencimento DESC, id DESC + LIMIT) and only then aggregate the
-- titulos and projetos for that page. These indexes back the ordering and the
-- per-conta aggregates.
--
-- The following already exist (created in 1734798000, 1734801000 and 1734835000)
-- and are intentionally NOT recreated here:
--   titulos_pagar(conta_pagar_id), titulos_receber(conta_receber_id),
--   contas_pagar(fornecedor_id), contas_pagar(matriz_id), contas_receber(matriz_id),
--   contas_pagar_projetos(conta_pagar_id), contas_receber_projetos(conta_receber_id)

-- Aggregates filtered by status (COUNT(*) FILTER (WHERE status = 'PAGO'/'RECEBIDO'))
CREATE INDEX IF NOT EXISTS idx_titulos_pagar_conta_status
  ON titulos_pagar(conta_pagar_id, status);

CREATE INDEX IF NOT EXISTS idx_titulos_receber_conta_status
  ON titulos_receber(conta_receber_id, status);

-- Ordering + pagination of the base CTE
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento_id
  ON contas_pagar(data_vencimento DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento_id
  ON contas_receber(data_vencimento DESC, id DESC);
