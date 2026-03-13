import { action } from '@uibakery/data';

function migrateExistingData() {
  return action('migrateExistingData', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- Verificar se as tabelas principais existem antes de migrar
      DO $$
      BEGIN
        -- Verificar se as tabelas necessárias existem
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'clientes', 'projetos', 'kanban_columns', 'parametros')
          HAVING COUNT(*) = 5
        ) THEN
          RAISE EXCEPTION 'Estrutura do banco não está completa. Execute a migração de estrutura primeiro.';
        END IF;

        -- 1. Migrar usuários se a tabela app_users existir no banco origem
        -- Como não podemos fazer cross-database, assumimos que os dados já foram inseridos
        
        -- 2. Inserir colunas kanban padrão se não existirem
        IF NOT EXISTS (SELECT 1 FROM kanban_columns) THEN
          INSERT INTO kanban_columns (name, position, color) VALUES
          ('To Do', 1, '#6B7280'),
          ('Em Progresso', 2, '#3B82F6'),
          ('Concluído', 3, '#10B981');
        END IF;

        -- 3. Inserir parâmetros padrão se não existem
        INSERT INTO parametros (chave, valor, descricao, tipo) 
        SELECT 'MOEDA', 'BRL', 'Moeda utilizada no sistema', 'opcao'
        WHERE NOT EXISTS (SELECT 1 FROM parametros WHERE chave = 'MOEDA');

        INSERT INTO parametros (chave, valor, descricao, tipo)
        SELECT 'TIMEZONE', 'America/Sao_Paulo', 'Fuso horário do sistema', 'texto'
        WHERE NOT EXISTS (SELECT 1 FROM parametros WHERE chave = 'TIMEZONE');

      END $$;

      -- 4. Retornar status da migração
      SELECT 
        'Configuração inicial concluída!' as status,
        'Execute a migração completa de estrutura primeiro.' as message,
        (
          SELECT COUNT(*) 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        ) as public_tables_count,
        (
          SELECT COUNT(*) 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('users', 'clientes', 'projetos', 'kanban_columns')
        ) as core_tables_available,
        CASE 
          WHEN EXISTS (SELECT 1 FROM kanban_columns) 
          THEN (SELECT COUNT(*) FROM kanban_columns)
          ELSE 0
        END as kanban_columns_count,
        CASE 
          WHEN EXISTS (SELECT 1 FROM parametros) 
          THEN (SELECT COUNT(*) FROM parametros)
          ELSE 0
        END as parametros_count;
    `,
  });
}

export default migrateExistingData;
