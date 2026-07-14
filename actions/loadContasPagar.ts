import { action } from '@uibakery/data';

function loadContasPagar() {
  return action('loadContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH base AS (
        SELECT cp.id
        FROM contas_pagar cp
        JOIN fornecedores f ON cp.fornecedor_id = f.id
        JOIN tipos_documento td ON cp.tipo_documento_id = td.id
        LEFT JOIN matrizes m ON cp.matriz_id = m.id
        {{ params && (params.searchStatus === 'PAGO_TOTAL' || params.searchStatus === 'PAGO_PARCIAL') ? "LEFT JOIN LATERAL (SELECT COUNT(*) AS qtd_total, COUNT(*) FILTER (WHERE tp.status = 'PAGO') AS qtd_pagos FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id) st ON TRUE" : "" }}
        WHERE 1 = 1
          {{ params && params.searchFornecedor ? "AND f.name ILIKE '%" + params.searchFornecedor + "%'" : "" }}
          {{ params && params.searchStatus === 'PENDENTE' ? "AND NOT EXISTS (SELECT 1 FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO')" : "" }}
          {{ params && params.searchStatus === 'PAGO_TOTAL' ? "AND st.qtd_total > 0 AND st.qtd_pagos = st.qtd_total" : "" }}
          {{ params && params.searchStatus === 'PAGO_PARCIAL' ? "AND st.qtd_pagos > 0 AND st.qtd_pagos < st.qtd_total" : "" }}
          {{ params && params.searchNumeroDocumento ? "AND cp.numero_documento ILIKE '%" + params.searchNumeroDocumento + "%'" : "" }}
          {{ params && params.searchProjeto ? "AND EXISTS (SELECT 1 FROM contas_pagar_projetos cpp JOIN projetos p ON p.id = cpp.projeto_id WHERE cpp.conta_pagar_id = cp.id AND p.name ILIKE '%" + params.searchProjeto + "%')" : "" }}
          {{ params && params.searchMatriz ? "AND m.nome ILIKE '%" + params.searchMatriz + "%'" : "" }}
          {{ params && params.dataVencimentoInicio ? "AND cp.data_vencimento >= '" + params.dataVencimentoInicio + "'" : "" }}
          {{ params && params.dataVencimentoFim ? "AND cp.data_vencimento <= '" + params.dataVencimentoFim + "'" : "" }}
          {{ params && params.dataPagamentoInicio ? "AND EXISTS (SELECT 1 FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO' AND tp.data_pagamento >= '" + params.dataPagamentoInicio + "')" : "" }}
          {{ params && params.dataPagamentoFim ? "AND EXISTS (SELECT 1 FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO' AND tp.data_pagamento <= '" + params.dataPagamentoFim + "')" : "" }}
        ORDER BY cp.data_vencimento DESC, cp.id DESC
        {{ params && params.page ? "OFFSET " + ((params.page - 1) * (params.limit || 25)) : "OFFSET 0" }}
        {{ params && params.limit ? "LIMIT " + params.limit : (params && params.hasFilters ? "LIMIT 25" : "LIMIT 5") }}
      ),
      titulos_agg AS (
        SELECT
          tp.conta_pagar_id,
          COUNT(*) AS total_titulos,
          COUNT(*) FILTER (WHERE tp.status = 'PAGO') AS titulos_pagos,
          MIN(tp.data_pagamento) FILTER (WHERE tp.status = 'PAGO') AS data_primeiro_pagamento,
          MAX(tp.data_pagamento) FILTER (WHERE tp.status = 'PAGO') AS data_ultimo_pagamento
        FROM titulos_pagar tp
        WHERE tp.conta_pagar_id IN (SELECT id FROM base)
        GROUP BY tp.conta_pagar_id
      ),
      projetos_agg AS (
        SELECT
          cpp.conta_pagar_id,
          STRING_AGG(DISTINCT p.name, ', ') AS projetos_nomes
        FROM contas_pagar_projetos cpp
        JOIN projetos p ON p.id = cpp.projeto_id
        WHERE cpp.conta_pagar_id IN (SELECT id FROM base)
        GROUP BY cpp.conta_pagar_id
      )
      SELECT
        cp.*,
        f.name as fornecedor_nome,
        td.descricao as tipo_documento_descricao,
        m.nome as matriz_nome,
        COALESCE(ta.total_titulos, 0) as total_titulos,
        COALESCE(ta.titulos_pagos, 0) as titulos_pagos,
        ta.data_primeiro_pagamento,
        ta.data_ultimo_pagamento,
        pa.projetos_nomes
      FROM base b
      JOIN contas_pagar cp ON cp.id = b.id
      JOIN fornecedores f ON cp.fornecedor_id = f.id
      JOIN tipos_documento td ON cp.tipo_documento_id = td.id
      LEFT JOIN matrizes m ON cp.matriz_id = m.id
      LEFT JOIN titulos_agg ta ON ta.conta_pagar_id = cp.id
      LEFT JOIN projetos_agg pa ON pa.conta_pagar_id = cp.id
      ORDER BY cp.data_vencimento DESC, cp.id DESC;
    `,
  });
}

export default loadContasPagar;
