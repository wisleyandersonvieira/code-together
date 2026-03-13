import { action } from '@uibakery/data';

function getLastSyncTime() {
  return action('getLastSyncTime', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT valor as last_sync 
      FROM parametros 
      WHERE chave = 'last_rds_sync'
      LIMIT 1;
    `,
  });
}

export default getLastSyncTime;
