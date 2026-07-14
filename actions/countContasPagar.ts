import { action } from '@uibakery/data';

function countContasPagar() {
  return action('countContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT COUNT(*) as total
      FROM contas_pagar cp
      {{ params && params.searchFornecedor ? "JOIN fornecedores f ON cp.fornecedor_id = f.id" : "" }}
      {{ params && params.searchMatriz ? "LEFT JOIN matrizes m ON cp.matriz_id = m.id" : "" }}
      {{ params && (params.searchStatus === 'PAGO_TOTAL' || params.searchStatus === 'PAGO_PARCIAL') ? "LEFT JOIN LATERAL (SELECT COUNT(*) AS qtd_total, COUNT(*) FILTER (WHERE tp.status = 'PAGO') AS qtd_pagos FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id) st ON TRUE" : "" }}
      WHERE {{ params && params.skipCount ? "FALSE" : "1 = 1" }}
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
        {{ params && params.dataPagamentoFim ? "AND EXISTS (SELECT 1 FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO' AND tp.data_pagamento <= '" + params.dataPagamentoFim + "')" : "" }};
    `,
  });
}

export default countContasPagar;
