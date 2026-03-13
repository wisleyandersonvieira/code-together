import { action } from '@uibakery/data';

function loadContasPagar() {
  return action('loadContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT DISTINCT
        cp.*,
        f.name as fornecedor_nome,
        td.descricao as tipo_documento_descricao,
        m.nome as matriz_nome,
        (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id) as total_titulos,
        (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') as titulos_pagos,
        (SELECT MIN(tp.data_pagamento) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') as data_primeiro_pagamento,
        (SELECT MAX(tp.data_pagamento) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') as data_ultimo_pagamento,
        STRING_AGG(DISTINCT p.name, ', ') as projetos_nomes
      FROM contas_pagar cp
      JOIN fornecedores f ON cp.fornecedor_id = f.id
      JOIN tipos_documento td ON cp.tipo_documento_id = td.id
      LEFT JOIN matrizes m ON cp.matriz_id = m.id
      LEFT JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
      LEFT JOIN projetos p ON cpp.projeto_id = p.id
      WHERE 1 = 1
        {{ params && params.searchFornecedor ? "AND f.name ILIKE '%" + params.searchFornecedor + "%'" : "" }}
        {{ params && params.searchStatus === 'PENDENTE' ? "AND (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') = 0" : "" }}
        {{ params && params.searchStatus === 'PAGO_TOTAL' ? "AND (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') = (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id) AND (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id) > 0" : "" }}
        {{ params && params.searchStatus === 'PAGO_PARCIAL' ? "AND (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') > 0 AND (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO') < (SELECT COUNT(*) FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id)" : "" }}
        {{ params && params.searchNumeroDocumento ? "AND cp.numero_documento ILIKE '%" + params.searchNumeroDocumento + "%'" : "" }}
        {{ params && params.searchProjeto ? "AND p.name ILIKE '%" + params.searchProjeto + "%'" : "" }}
        {{ params && params.searchMatriz ? "AND m.nome ILIKE '%" + params.searchMatriz + "%'" : "" }}
        {{ params && params.dataVencimentoInicio ? "AND cp.data_vencimento >= '" + params.dataVencimentoInicio + "'" : "" }}
        {{ params && params.dataVencimentoFim ? "AND cp.data_vencimento <= '" + params.dataVencimentoFim + "'" : "" }}
        {{ params && params.dataPagamentoInicio ? "AND EXISTS (SELECT 1 FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO' AND tp.data_pagamento >= '" + params.dataPagamentoInicio + "')" : "" }}
        {{ params && params.dataPagamentoFim ? "AND EXISTS (SELECT 1 FROM titulos_pagar tp WHERE tp.conta_pagar_id = cp.id AND tp.status = 'PAGO' AND tp.data_pagamento <= '" + params.dataPagamentoFim + "')" : "" }}
      GROUP BY cp.id, f.name, td.descricao, m.nome
      ORDER BY cp.data_vencimento DESC, cp.id DESC
      {{ params && params.page ? "OFFSET " + ((params.page - 1) * (params.limit || 25)) : "OFFSET 0" }}
      {{ params && params.limit ? "LIMIT " + params.limit : (params && params.hasFilters ? "LIMIT 25" : "LIMIT 5") }};
    `,
  });
}

export default loadContasPagar;
