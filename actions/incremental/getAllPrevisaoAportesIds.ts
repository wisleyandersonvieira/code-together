import { action } from '@uibakery/data';

function getAllPrevisaoAportesIds() {
  return action('getAllPrevisaoAportesIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM previsao_aportes 
      ORDER BY id;
    `,
  });
}

export default getAllPrevisaoAportesIds;
