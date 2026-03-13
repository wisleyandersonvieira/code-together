import { action } from '@uibakery/data';

function migrateAllDataToSupabase() {
  return action('migrateAllDataToSupabase', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Migração completa de dados do banco local para Supabase
      -- Esta query extrai todos os dados para serem inseridos via script
      
      SELECT 
        'migration_data' as operation,
        
        -- 1. Usuários
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, email, phone, role, status, 
                 password_hash as encrypted_password,
                 password_reset_token, password_reset_expires as password_reset_expires_at,
                 last_login as last_login_at, created_at, updated_at
          FROM users ORDER BY id
        ) t) as users_data,
        
        -- 2. Clientes
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, address, phone, email, cpf, birth_date,
                 file_urls, active, created_at, updated_at
          FROM clientes ORDER BY id
        ) t) as clientes_data,
        
        -- 3. Empresas
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, number, file_urls, created_at, updated_at
          FROM empresas ORDER BY id
        ) t) as empresas_data,
        
        -- 4. Grupos
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, file_urls, created_at, updated_at
          FROM grupos ORDER BY id
        ) t) as grupos_data,
        
        -- 5. Fornecedores
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, address, phone, email, contact_name,
                 contact_phone, ein_number, created_at, updated_at
          FROM fornecedores ORDER BY id
        ) t) as fornecedores_data,
        
        -- 6. Kanban Columns
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, position, color, created_at, updated_at
          FROM kanban_columns ORDER BY position
        ) t) as kanban_columns_data,
        
        -- 7. Projetos
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, address, city, construction_sqft, land_sqft,
                 details, predicted_sale_value, photo_urls, document_urls,
                 status, kanban_column_id, kanban_position, created_at, updated_at
          FROM projetos ORDER BY id
        ) t) as projetos_data,
        
        -- 8. Parâmetros
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, chave, valor, descricao, tipo, created_at, updated_at
          FROM parametros ORDER BY id
        ) t) as parametros_data,
        
        -- 9. Contas
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, nome, numero, banco, saldo_inicial, data_saldo_inicial,
                 descricao, created_at, updated_at
          FROM contas ORDER BY id
        ) t) as contas_data,
        
        -- 10. Grupos Contábeis
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, descricao, tipo, created_at, updated_at
          FROM grupos_contabeis ORDER BY id
        ) t) as grupos_contabeis_data,
        
        -- Contadores
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM clientes) as clientes_count,
        (SELECT COUNT(*) FROM projetos) as projetos_count,
        (SELECT COUNT(*) FROM contas_pagar) as contas_pagar_count,
        (SELECT COUNT(*) FROM contas_receber) as contas_receber_count
        ;
    `,
  });
}

export default migrateAllDataToSupabase;
