import { action } from '@uibakery/data';

function loadJornadaById() {
  return action('loadJornadaById', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        j.id,
        j.entity_type,
        j.entity_id,
        ent.entity_name,
        j.fluxo_id,
        f.nome AS fluxo_nome,
        f.avanco_automatico,
        j.status,
        j.data_inicio,
        j.data_conclusao,
        j.observacoes,
        j.responsavel_user_id,
        u.name AS responsavel_nome,
        j.etapa_atual_item_id,
        fe.nome AS etapa_atual_nome,
        j.total_etapas,
        j.etapas_concluidas,
        j.progresso,
        j.created_at,
        j.updated_at
      FROM jornadas j
      LEFT JOIN users u ON u.id = j.responsavel_user_id
      LEFT JOIN jornada_fluxos f ON f.id = j.fluxo_id
      LEFT JOIN jornada_etapa_itens atual ON atual.id = j.etapa_atual_item_id
      LEFT JOIN jornada_fluxo_etapas fe ON fe.id = atual.fluxo_etapa_id
      LEFT JOIN vw_operacao_entidades ent
        ON ent.entity_type = j.entity_type AND ent.entity_id = j.entity_id
      WHERE j.id = {{ params && params.id ? Number(params.id) : "NULL" }};
    `,
  });
}

export default loadJornadaById;
