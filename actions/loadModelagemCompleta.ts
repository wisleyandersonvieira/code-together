import { action } from '@uibakery/data';

/**
 * Carrega a modelagem inteira num único SELECT.
 *
 * O edge function só aceita um statement por chamada, então em vez de sete
 * round-trips as tabelas filhas vêm agregadas em JSON. O motor precisa de todas
 * elas juntas para calcular — carregar em partes só criaria estados intermediários
 * inconsistentes na tela.
 */
function loadModelagemCompleta() {
  return action('loadModelagemCompleta', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        m.*,
        (
          SELECT json_agg(u ORDER BY u.ordem, u.id)
          FROM modelagem_unidades u WHERE u.modelagem_id = m.id
        ) AS unidades,
        -- As parcelas vêm ANINHADAS dentro do custo, não como segunda lista.
        -- Cruzar duas listas por custo_id no cliente é justamente onde a parcela
        -- de um custo recém-criado se perderia; aninhada, ela chega junto com o
        -- dono. Sem parcela nenhuma o sub-select devolve '[]', nunca NULL.
        (SELECT json_agg(c2 ORDER BY c2.ordem, c2.id) FROM (
           SELECT c.*, (
             SELECT COALESCE(json_agg(p ORDER BY p.ordem, p.mes), '[]'::json)
             FROM modelagem_custo_parcelas p WHERE p.custo_id = c.id
           ) AS parcelas
           FROM modelagem_custos c WHERE c.modelagem_id = m.id
         ) c2) AS custos,
        (
          SELECT row_to_json(a) FROM modelagem_aportes a WHERE a.modelagem_id = m.id
        ) AS aportes,
        (
          SELECT json_agg(pa ORDER BY pa.mes)
          FROM modelagem_aporte_parcelas pa WHERE pa.modelagem_id = m.id
        ) AS aporte_parcelas,
        (
          SELECT json_agg(fa ORDER BY fa.ordem, fa.id)
          FROM modelagem_fases fa WHERE fa.modelagem_id = m.id
        ) AS fases,
        (
          SELECT json_agg(uf)
          FROM modelagem_unidade_fases uf WHERE uf.modelagem_id = m.id
        ) AS unidade_fases,
        (
          SELECT row_to_json(f) FROM modelagem_financiamento f WHERE f.modelagem_id = m.id
        ) AS financiamento,
        (
          SELECT json_agg(bc ORDER BY bc.mes)
          FROM modelagem_benchmark_curva bc WHERE bc.modelagem_id = m.id
        ) AS benchmark_curva,
        (
          SELECT json_agg(s ORDER BY s.ordem, s.id)
          FROM modelagem_socios s WHERE s.modelagem_id = m.id
        ) AS socios,
        (
          SELECT row_to_json(r) FROM modelagem_receita r WHERE r.modelagem_id = m.id
        ) AS receita,
        (
          SELECT json_agg(v) FROM modelagem_vendas_unidade v WHERE v.modelagem_id = m.id
        ) AS vendas_unidade,
        (
          SELECT json_agg(td ORDER BY td.ordem, td.mes, td.id)
          FROM modelagem_takedowns td WHERE td.modelagem_id = m.id
        ) AS takedowns,
        (
          SELECT json_agg(cn ORDER BY cn.is_baseline DESC, cn.id)
          FROM modelagem_cenarios cn WHERE cn.modelagem_id = m.id
        ) AS cenarios,
        (
          SELECT json_agg(o ORDER BY o.mes, o.linha)
          FROM modelagem_overrides o
          WHERE o.modelagem_id = m.id
            AND o.cenario_id = COALESCE(
              {{params.cenarioId}}::int,
              (SELECT id FROM modelagem_cenarios b WHERE b.modelagem_id = m.id AND b.is_baseline LIMIT 1)
            )
        ) AS overrides
      FROM modelagens m
      WHERE m.id = {{params.id}}::int
    `,
  });
}

export default loadModelagemCompleta;
