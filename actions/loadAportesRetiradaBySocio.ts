import { action } from '@uibakery/data';

function loadAportesRetiradaBySocio() {
  return action('loadAportesRetiradaBySocio', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        s.id as socio_id,
        s.nome as socio_nome,
        'aporte' as tipo,
        SUM(COALESCE(a.valor, 0)) as valor_total,
        COUNT(a.id) as qtd_lancamentos
      FROM aportes a
      INNER JOIN socios s ON a.socio_id = s.id
      WHERE a.conta_id = {{params.contaId}}
        AND a.data_aporte IS NOT NULL
        {{ params.dataInicio ? "AND a.data_aporte >= '" + params.dataInicio + "'::date" : "" }}
        {{ params.dataFim    ? "AND a.data_aporte <= '" + params.dataFim    + "'::date" : "" }}
        {{ params.matrizId   ? "AND a.matriz_id = " + params.matrizId : "" }}
      GROUP BY s.id, s.nome

      UNION ALL

      SELECT
        s.id as socio_id,
        s.nome as socio_nome,
        'retirada' as tipo,
        SUM(COALESCE(r.valor, 0)) as valor_total,
        COUNT(r.id) as qtd_lancamentos
      FROM retiradas r
      INNER JOIN socios s ON r.socio_id = s.id
      WHERE r.conta_id = {{params.contaId}}
        AND r.data_retirada IS NOT NULL
        {{ params.dataInicio ? "AND r.data_retirada >= '" + params.dataInicio + "'::date" : "" }}
        {{ params.dataFim    ? "AND r.data_retirada <= '" + params.dataFim    + "'::date" : "" }}
        {{ params.matrizId   ? "AND r.matriz_id = " + params.matrizId : "" }}
      GROUP BY s.id, s.nome

      UNION ALL

      SELECT
        s.id as socio_id,
        s.nome as socio_nome,
        'emprestimo' as tipo,
        SUM(COALESCE(e.valor, 0)) as valor_total,
        COUNT(e.id) as qtd_lancamentos
      FROM emprestimos e
      INNER JOIN socios s ON e.socio_id = s.id
      WHERE e.conta_id = {{params.contaId}}
        AND e.tipo = 'EMPRESTIMO'
        AND e.data_emprestimo IS NOT NULL
        {{ params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'::date" : "" }}
        {{ params.dataFim    ? "AND e.data_emprestimo <= '" + params.dataFim    + "'::date" : "" }}
        {{ params.matrizId   ? "AND e.matriz_id = " + params.matrizId : "" }}
      GROUP BY s.id, s.nome

      UNION ALL

      SELECT
        s.id as socio_id,
        s.nome as socio_nome,
        'pagamento_emprestimo' as tipo,
        SUM(COALESCE(e.valor, 0)) as valor_total,
        COUNT(e.id) as qtd_lancamentos
      FROM emprestimos e
      INNER JOIN socios s ON e.socio_id = s.id
      WHERE e.conta_id = {{params.contaId}}
        AND e.tipo = 'PAGAMENTO'
        AND e.data_emprestimo IS NOT NULL
        {{ params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'::date" : "" }}
        {{ params.dataFim    ? "AND e.data_emprestimo <= '" + params.dataFim    + "'::date" : "" }}
        {{ params.matrizId   ? "AND e.matriz_id = " + params.matrizId : "" }}
      GROUP BY s.id, s.nome

      ORDER BY socio_nome, tipo;
    `,
  });
}

export default loadAportesRetiradaBySocio;
