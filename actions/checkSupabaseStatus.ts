import { action } from '@uibakery/data';

function checkSupabaseStatus() {
  return action('checkSupabaseStatus', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      SELECT 
        'Supabase está conectado e funcionando!' as status,
        CURRENT_TIMESTAMP as checked_at,
        (
          SELECT COUNT(*) 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'clientes', 'projetos', 'kanban_columns')
        ) as tables_migrated,
        CASE 
          WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kanban_columns') 
          THEN (SELECT COUNT(*) FROM kanban_columns)
          ELSE 0 
        END as kanban_columns_count;
    `,
  });
}

export default checkSupabaseStatus;
