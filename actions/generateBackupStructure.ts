import { action } from '@uibakery/data';

function generateBackupStructure() {
  return action('generateBackupStructure', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Get all table schemas
      SELECT 
        t.table_name,
        string_agg(
          c.column_name || ' ' || 
          c.data_type || 
          CASE 
            WHEN c.character_maximum_length IS NOT NULL 
            THEN '(' || c.character_maximum_length || ')'
            WHEN c.numeric_precision IS NOT NULL AND c.numeric_scale IS NOT NULL
            THEN '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
            ELSE ''
          END ||
          CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
          ', ' ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name != 'uib_migrations'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `,
  });
}

export default generateBackupStructure;
