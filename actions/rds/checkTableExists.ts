import { action } from '@uibakery/data';

function checkTableExists() {
  return action('checkTableExists', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '{{params.tableName}}'
      ) as table_exists;
    `,
  });
}

export default checkTableExists;
