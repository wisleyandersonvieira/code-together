import { action } from '@uibakery/data';

function loadMatrizes() {
  return action('loadMatrizes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        m.id,
        m.nome,
        m.cnpj_ein,
        m.endereco,
        m.created_at,
        m.updated_at,
        COUNT(ms.socio_id) as total_socios
      FROM matrizes m
      LEFT JOIN matriz_socios ms ON m.id = ms.matriz_id
      WHERE 1 = 1
        {{ params && params.searchNome ? "AND m.nome ILIKE '%" + params.searchNome + "%'" : "" }}
      GROUP BY m.id, m.nome, m.cnpj_ein, m.endereco, m.created_at, m.updated_at
      ORDER BY m.nome;
    `,
  });
}

export default loadMatrizes;
