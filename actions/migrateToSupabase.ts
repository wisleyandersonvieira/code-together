import { action } from '@uibakery/data';

function migrateToSupabase() {
  return action('migrateToSupabase', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- This action will execute the complete migration
      -- Due to query size limits, we'll break this into parts
      
      -- First check if migration is needed
      SELECT 
        CASE 
          WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
          THEN 'Database already migrated' 
          ELSE 'Ready to migrate' 
        END as migration_status;
    `,
  });
}

export default migrateToSupabase;
