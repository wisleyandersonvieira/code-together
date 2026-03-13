import { action } from '@uibakery/data';

function generateBackupData() {
  return action('generateBackupData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = t.table_name) as record_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name != 'uib_migrations'
      ORDER BY t.table_name;
    `,
  });
}

export default generateBackupData;
