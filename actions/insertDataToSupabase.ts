import { action } from '@uibakery/data';

function insertDataToSupabase() {
  return action('insertDataToSupabase', 'SQL', {
    databaseName: 'provisonsupabase',
    query: `
      -- Esta ação será usada pelo componente para inserir dados migrados
      -- Os dados serão passados como parâmetros JSON
      
      WITH inserted_users AS (
        INSERT INTO users (id, name, email, phone, role, status, encrypted_password, 
                          password_reset_token, password_reset_expires_at, 
                          last_login_at, created_at, updated_at)
        SELECT (data->>'id')::int, data->>'name', data->>'email', data->>'phone', 
               data->>'role', data->>'status', data->>'encrypted_password',
               CASE WHEN data->>'password_reset_token' != 'null' THEN data->>'password_reset_token' END,
               CASE WHEN data->>'password_reset_expires_at' != 'null' THEN (data->>'password_reset_expires_at')::timestamp END,
               CASE WHEN data->>'last_login_at' != 'null' THEN (data->>'last_login_at')::timestamp END,
               (data->>'created_at')::timestamp, (data->>'updated_at')::timestamp
        FROM json_array_elements({{params.users_data}}::json) AS data
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      ),
      inserted_clientes AS (
        INSERT INTO clientes (id, name, address, phone, email, cpf, birth_date,
                             file_urls, active, created_at, updated_at)  
        SELECT (data->>'id')::int, data->>'name', data->>'address', data->>'phone',
               data->>'email', data->>'cpf', 
               CASE WHEN data->>'birth_date' != 'null' THEN (data->>'birth_date')::date END,
               CASE WHEN data->'file_urls' != 'null' THEN 
                 ARRAY(SELECT json_array_elements_text(data->'file_urls'))::text[] 
               END,
               COALESCE((data->>'active')::boolean, true),
               (data->>'created_at')::timestamp, (data->>'updated_at')::timestamp
        FROM json_array_elements({{params.clientes_data}}::json) AS data
        ON CONFLICT (cpf) DO NOTHING
        RETURNING id
      ),
      inserted_kanban AS (
        INSERT INTO kanban_columns (id, name, position, color, created_at, updated_at)
        SELECT (data->>'id')::int, data->>'name', (data->>'position')::int, 
               data->>'color', (data->>'created_at')::timestamp, (data->>'updated_at')::timestamp
        FROM json_array_elements({{params.kanban_columns_data}}::json) AS data
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT 
        'Migração executada com sucesso!' as status,
        (SELECT COUNT(*) FROM inserted_users) as users_migrated,
        (SELECT COUNT(*) FROM inserted_clientes) as clientes_migrated,
        (SELECT COUNT(*) FROM inserted_kanban) as kanban_migrated,
        NOW() as migrated_at;
    `,
  });
}

export default insertDataToSupabase;
