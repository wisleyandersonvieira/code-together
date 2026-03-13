import { action } from '@uibakery/data';

function runSupabaseMigration() {
  return action('runSupabaseMigration', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- Primeira parte da migração: estrutura básica
      
      -- Verificar se as tabelas já existem
      SELECT 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name IN ('users', 'clientes', 'projetos', 'kanban_columns', 'grupos_contabeis')
          ) 
          THEN 'Algumas tabelas já existem - migração parcial ou completa já executada'
          ELSE 'Pronto para executar migração completa'
        END as migration_status,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as existing_tables_count,
        CURRENT_TIMESTAMP as checked_at;
    `,
  });
}

export default runSupabaseMigration;
