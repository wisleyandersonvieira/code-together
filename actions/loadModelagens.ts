import { action } from '@uibakery/data';

/**
 * Lista de modelagens, já com as tabelas filhas agregadas.
 *
 * Traz os filhos de propósito: a lista mostra lucro projetado, MOIC e TIR, e
 * esses números só existem rodando o motor. Estimar na consulta produziria um
 * valor que não bate com o da tela de detalhe — que é exatamente o tipo de
 * divergência que o módulo inteiro foi feito para evitar.
 */
function loadModelagens() {
  return action('loadModelagens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        m.*,
        (SELECT json_agg(u ORDER BY u.ordem, u.id) FROM modelagem_unidades u WHERE u.modelagem_id = m.id) AS unidades,
        (SELECT json_agg(c ORDER BY c.ordem, c.id) FROM modelagem_custos c WHERE c.modelagem_id = m.id) AS custos,
        (SELECT row_to_json(f) FROM modelagem_financiamento f WHERE f.modelagem_id = m.id) AS financiamento,
        (SELECT json_agg(s ORDER BY s.ordem, s.id) FROM modelagem_socios s WHERE s.modelagem_id = m.id) AS socios,
        (SELECT row_to_json(r) FROM modelagem_receita r WHERE r.modelagem_id = m.id) AS receita,
        (SELECT json_agg(v) FROM modelagem_vendas_unidade v WHERE v.modelagem_id = m.id) AS vendas_unidade,
        (
          SELECT json_agg(o)
          FROM modelagem_overrides o
          JOIN modelagem_cenarios b ON b.id = o.cenario_id AND b.is_baseline
          WHERE o.modelagem_id = m.id
        ) AS overrides
      FROM modelagens m
      WHERE 1 = 1
      {{ params && params.busca ? "AND m.nome ILIKE '%" + params.busca + "%'" : "" }}
      {{ params && params.status ? "AND m.status = '" + params.status + "'" : "" }}
      ORDER BY m.updated_at DESC, m.id DESC
    `,
  });
}

export default loadModelagens;
