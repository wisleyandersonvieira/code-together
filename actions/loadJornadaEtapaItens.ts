import { action } from '@uibakery/data';

/**
 * Devolve as etapas da jornada já mescladas com o catálogo: etapas ativas ainda
 * não usadas aparecem como pendentes (item_id nulo) e etapas inativadas seguem
 * visíveis enquanto estiverem vinculadas à jornada.
 */
function loadJornadaEtapaItens() {
  return action('loadJornadaEtapaItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        i.id AS item_id,
        e.id AS etapa_id,
        e.nome AS etapa_nome,
        e.descricao AS etapa_descricao,
        e.ativo AS etapa_ativa,
        COALESCE(i.ordem, e.ordem) AS ordem,
        COALESCE(i.status, 'PENDENTE') AS status,
        i.data_prevista,
        i.data_inicio,
        i.data_conclusao,
        i.responsavel_user_id,
        u.name AS responsavel_nome,
        i.observacoes
      FROM jornada_etapas e
      LEFT JOIN jornada_etapa_itens i
        ON i.etapa_id = e.id
       AND i.jornada_id = {{ params && params.jornadaId ? Number(params.jornadaId) : "NULL" }}
      LEFT JOIN users u ON u.id = i.responsavel_user_id
      WHERE e.ativo = true OR i.id IS NOT NULL
      ORDER BY COALESCE(i.ordem, e.ordem), e.id;
    `,
  });
}

export default loadJornadaEtapaItens;
