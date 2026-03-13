import { action } from '@uibakery/data';

function getAllProjetoColumnHistoryIds() {
  return action('getAllProjetoColumnHistoryIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM projeto_column_history 
      ORDER BY id;
    `,
  });
}

export default getAllProjetoColumnHistoryIds;
