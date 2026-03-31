import { action } from '@uibakery/data';

function loadExtratoByGrupoContabil() {
  return action('loadExtratoByGrupoContabil', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH saidas AS (
        SELECT
          COALESCE(gc.descricao, 'Sem Grupo') as grupo_nome,
          gc.id as grupo_id,
          'saida' as direcao,
          SUM(
            CASE
              WHEN tp.status = 'PAGO' THEN COALESCE(tp.valor_pago, 0)
              ELSE COALESCE(tp.valor, 0)
            END
          ) as valor_total,
          COUNT(DISTINCT tp.id) as qtd_lancamentos
        FROM titulos_pagar tp
        JOIN contas_pagar cp ON tp.conta_pagar_id = cp.id
        LEFT JOIN contas_pagar_itens cpi ON cp.id = cpi.conta_pagar_id
        LEFT JOIN produtos pr ON cpi.produto_id = pr.id
        LEFT JOIN subgrupos_contabeis sc ON pr.subgrupo_id = sc.id
        LEFT JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
        WHERE tp.conta_id = {{params.contaId}}
          AND tp.status = 'PAGO'
          AND tp.data_pagamento IS NOT NULL
          {{ params.dataInicio ? "AND tp.data_pagamento >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND tp.data_pagamento <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.matrizId   ? "AND cp.matriz_id = " + params.matrizId : "" }}
        GROUP BY gc.id, gc.descricao
      ),
      entradas AS (
        SELECT
          COALESCE(gc.descricao, 'Sem Grupo') as grupo_nome,
          gc.id as grupo_id,
          'entrada' as direcao,
          SUM(COALESCE(tr.valor_recebido, 0)) as valor_total,
          COUNT(DISTINCT tr.id) as qtd_lancamentos
        FROM titulos_receber tr
        JOIN contas_receber cr ON tr.conta_receber_id = cr.id
        LEFT JOIN contas_receber_itens cri ON cr.id = cri.conta_receber_id
        LEFT JOIN produtos pr ON cri.produto_id = pr.id
        LEFT JOIN subgrupos_contabeis sc ON pr.subgrupo_id = sc.id
        LEFT JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
        WHERE tr.conta_id = {{params.contaId}}
          AND tr.status = 'RECEBIDO'
          AND tr.data_recebimento IS NOT NULL
          {{ params.dataInicio ? "AND tr.data_recebimento >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim    ? "AND tr.data_recebimento <= '" + params.dataFim    + "'::date" : "" }}
          {{ params.matrizId   ? "AND cr.matriz_id = " + params.matrizId : "" }}
        GROUP BY gc.id, gc.descricao
      )
      SELECT * FROM saidas
      UNION ALL
      SELECT * FROM entradas
      ORDER BY grupo_nome, direcao;
    `,
  });
}

export default loadExtratoByGrupoContabil;
