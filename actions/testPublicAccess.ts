import { action } from '@uibakery/data';

function testPublicAccess() {
  return action('testPublicAccess', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        'Public access working' as message,
        CURRENT_TIMESTAMP as timestamp,
        'Business plan activated' as plan_status;
    `,
  });
}

export default testPublicAccess;
