import { action } from '@uibakery/data';

function insertSupabaseDefaults() {
  return action('insertSupabaseDefaults', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- Inserir dados padrão no Supabase
      
      -- Inserir colunas do kanban padrão
      INSERT INTO kanban_columns (name, position, color) 
      SELECT 'To Do', 1, '#6B7280' 
      WHERE NOT EXISTS (SELECT 1 FROM kanban_columns WHERE name = 'To Do');
      
      INSERT INTO kanban_columns (name, position, color) 
      SELECT 'Em Progresso', 2, '#3B82F6' 
      WHERE NOT EXISTS (SELECT 1 FROM kanban_columns WHERE name = 'Em Progresso');
      
      INSERT INTO kanban_columns (name, position, color) 
      SELECT 'Concluído', 3, '#10B981' 
      WHERE NOT EXISTS (SELECT 1 FROM kanban_columns WHERE name = 'Concluído');
      
      -- Inserir um usuário admin padrão
      INSERT INTO app_users (name, email, role, status)
      SELECT 'Admin', 'admin@sistema.com', 'admin', 'active'
      WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'admin@sistema.com');
      
      SELECT 
        'Dados padrão inseridos!' as status,
        (SELECT COUNT(*) FROM kanban_columns) as kanban_columns,
        (SELECT COUNT(*) FROM app_users) as app_users,
        CURRENT_TIMESTAMP as executed_at;
    `,
  });
}

export default insertSupabaseDefaults;
