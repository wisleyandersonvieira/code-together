import { action } from '@uibakery/data';

function loadRelatorioClienteDespesas() {
  return action('loadRelatorioClienteDespesas', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH dedup AS (
        SELECT DISTINCT ON (tp.id)
          tp.id            AS titulo_id,
          tp.data_vencimento,
          tp.data_pagamento,
          f.name           AS fornecedor_nome,
          p.name           AS projeto_nome,
          -- Quando há rateio por projeto, calcula o valor proporcional
          CASE 
            WHEN cpp.percentual IS NOT NULL AND cpp.percentual > 0 
              THEN ROUND(tp.valor * cpp.percentual / 100.0, 2)
            ELSE tp.valor
          END              AS valor,
          c.nome           AS conta_nome,
          tp.parcela,
          tp.total_parcelas,
          tp.status,
          CASE
            WHEN tp.status = 'PAGO' THEN 'Quitada'
            ELSE 'Pendente'
          END              AS situacao_pagamento,
          cp.numero_documento
        FROM titulos_pagar tp
        INNER JOIN contas_pagar cp         ON tp.conta_pagar_id = cp.id
        INNER JOIN fornecedores f          ON cp.fornecedor_id  = f.id
        LEFT  JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
        LEFT  JOIN projetos p              ON cpp.projeto_id    = p.id
        LEFT  JOIN contas c               ON tp.conta_id       = c.id
        WHERE
          ({{params.projetoId}} IS NULL OR p.id = {{params.projetoId}})
          AND ({{params.contaId}} IS NULL OR tp.conta_id = {{params.contaId}})
          AND ({{params.situacaoPagamento}} IS NULL OR
               ({{params.situacaoPagamento}} = 'quitado'  AND tp.status = 'PAGO') OR
               ({{params.situacaoPagamento}} = 'pendente' AND tp.status != 'PAGO'))
          {{ params.dataVencimentoInicio ? "AND tp.data_vencimento >= '" + params.dataVencimentoInicio + "'::date" : "" }}
          {{ params.dataVencimentoFim   ? "AND tp.data_vencimento <= '" + params.dataVencimentoFim   + "'::date" : "" }}
          {{ params.dataPagamentoInicio ? "AND tp.data_pagamento  >= '" + params.dataPagamentoInicio + "'::date" : "" }}
          {{ params.dataPagamentoFim   ? "AND tp.data_pagamento  <= '" + params.dataPagamentoFim   + "'::date" : "" }}
        -- DISTINCT ON requer ORDER iniciando pela coluna de dedup
        ORDER BY tp.id, p.name NULLS LAST
      )
      SELECT *
      FROM dedup
      ORDER BY data_vencimento DESC NULLS LAST, projeto_nome NULLS LAST;
    `,
  });
}

export default loadRelatorioClienteDespesas;
