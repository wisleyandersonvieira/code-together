import { action } from '@uibakery/data';

/**
 * Lista de modelagens, já com as tabelas filhas agregadas.
 *
 * Traz os filhos de propósito: a lista mostra lucro projetado, MOIC e TIR, e
 * esses números só existem rodando o motor. Estimar na consulta produziria um
 * valor que não bate com o da tela de detalhe — que é exatamente o tipo de
 * divergência que o módulo inteiro foi feito para evitar.
 *
 * Pela mesma razão a consulta traz aportes, parcelas, fases e alocação: os três
 * mudam o fluxo, e sem eles a lista mostraria um MOIC diferente do da tela de
 * detalhe da MESMA modelagem.
 */
function loadModelagens() {
  return action('loadModelagens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        m.*,
        (SELECT json_agg(u ORDER BY u.ordem, u.id) FROM modelagem_unidades u WHERE u.modelagem_id = m.id) AS unidades,
        (SELECT json_agg(c ORDER BY c.ordem, c.id) FROM modelagem_custos c WHERE c.modelagem_id = m.id) AS custos,
        (SELECT row_to_json(a) FROM modelagem_aportes a WHERE a.modelagem_id = m.id) AS aportes,
        (SELECT json_agg(pa ORDER BY pa.mes) FROM modelagem_aporte_parcelas pa WHERE pa.modelagem_id = m.id) AS aporte_parcelas,
        (SELECT json_agg(fa ORDER BY fa.ordem, fa.id) FROM modelagem_fases fa WHERE fa.modelagem_id = m.id) AS fases,
        (SELECT json_agg(uf) FROM modelagem_unidade_fases uf WHERE uf.modelagem_id = m.id) AS unidade_fases,
        -- json_agg desde a migration 1764200000: a tabela deixou de ser 1:1.
        -- A ordem é a mesma do loadModelagemCompleta — a posição define qual
        -- facilidade um override "draw:N" endereça, e as duas cargas não podem
        -- discordar sobre isso.
        (SELECT json_agg(f ORDER BY f.ordem, f.id) FROM modelagem_financiamento f WHERE f.modelagem_id = m.id) AS financiamentos,
        (SELECT row_to_json(l) FROM modelagem_locacao l WHERE l.modelagem_id = m.id) AS locacao,
        (SELECT json_agg(op ORDER BY op.ordem, op.id) FROM modelagem_opex op WHERE op.modelagem_id = m.id) AS opex,
        (SELECT json_agg(oc ORDER BY oc.mes) FROM modelagem_ocupacao oc WHERE oc.modelagem_id = m.id) AS ocupacao,
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
