import { action } from '@uibakery/data';

/**
 * Consolidated query that loads all dropdown data needed for ProjetoForm
 * in a single database call: clientes, empresas, grupos, and fornecedores.
 */
function loadProjetoFormData() {
  return action('loadProjetoFormData', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT json_build_object(
        'clientes', (
          SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.name), '[]'::json)
          FROM (SELECT id, name FROM clientes WHERE active = true ORDER BY name) c
        ),
        'empresas', (
          SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.name), '[]'::json)
          FROM (SELECT id, name FROM empresas ORDER BY name) e
        ),
        'grupos', (
          SELECT COALESCE(json_agg(row_to_json(g) ORDER BY g.name), '[]'::json)
          FROM (SELECT id, name FROM grupos ORDER BY name) g
        ),
        'fornecedores', (
          SELECT COALESCE(json_agg(row_to_json(f) ORDER BY f.name), '[]'::json)
          FROM (SELECT id, name FROM fornecedores ORDER BY name) f
        )
      ) as data;
    `,
  });
}

export default loadProjetoFormData;
