import { action } from '@uibakery/data';

function loadJornadaById() {
  return action('loadJornadaById', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        j.id,
        j.entity_type,
        j.entity_id,
        COALESCE(c.name, em.name, g.name) AS entity_name,
        j.status,
        j.data_inicio,
        j.data_conclusao,
        j.observacoes,
        j.responsavel_user_id,
        u.name AS responsavel_nome,
        j.etapa_atual_id,
        ea.nome AS etapa_atual_nome,
        j.total_etapas,
        j.etapas_concluidas,
        j.progresso,
        j.created_at,
        j.updated_at
      FROM jornadas j
      LEFT JOIN users u ON u.id = j.responsavel_user_id
      LEFT JOIN jornada_etapas ea ON ea.id = j.etapa_atual_id
      LEFT JOIN clientes c ON j.entity_type = 'cliente' AND c.id = j.entity_id
      LEFT JOIN empresas em ON j.entity_type = 'empresa' AND em.id = j.entity_id
      LEFT JOIN grupos g ON j.entity_type = 'grupo' AND g.id = j.entity_id
      WHERE j.id = {{ params && params.id ? Number(params.id) : "NULL" }};
    `,
  });
}

export default loadJornadaById;
