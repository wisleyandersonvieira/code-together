import { action } from '@uibakery/data';

function checkNetworkStatus() {
  return action('checkNetworkStatus', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        'Application is running' as status,
        NOW() as server_time,
        'Database connection OK' as database_status;
    `,
  });
}

export default checkNetworkStatus;
