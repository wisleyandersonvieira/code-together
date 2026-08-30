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
        (
          SELECT json_agg(c ORDER BY c.ordem, c.id)
          FROM modelagem_custos c WHERE c.modelagem_id = m.id
        ) AS custos,
        (
          SELECT row_to_json(a) FROM modelagem_aportes a WHERE a.modelagem_id = m.id
        ) AS aportes,
        (
          SELECT row_to_json(f) FROM modelagem_financiamento f WHERE f.modelagem_id = m.id
        ) AS financiamento,
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
