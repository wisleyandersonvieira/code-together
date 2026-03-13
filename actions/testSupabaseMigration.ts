import { action } from '@uibakery/data';

function testSupabaseMigration() {
  return action('testSupabaseMigration', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      SELECT 
        'Migração executada com sucesso!' as status,
        CURRENT_TIMESTAMP as checked_at,
        (SELECT COUNT(*) FROM kanban_columns) as kanban_columns_count,
        (SELECT COUNT(*) FROM projetos) as projetos_count,
        (SELECT COUNT(*) FROM clientes) as clientes_count,
        (SELECT COUNT(*) FROM app_users) as app_users_count;
    `,
  });
}

export default testSupabaseMigration;
