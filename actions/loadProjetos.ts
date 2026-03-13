import { action } from '@uibakery/data';

function loadProjetos() {
  return action('loadProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id, p.name, p.address, p.city, p.construction_sqft, p.land_sqft, 
        p.details, p.predicted_sale_value, p.status, p.photo_urls, p.document_urls, p.created_at, p.updated_at,
        COALESCE(
          (SELECT JSON_AGG(sub.orc ORDER BY sub.id) FROM (
            SELECT DISTINCT ON (o.id) JSON_BUILD_OBJECT(
              'id', o.id,
              'description', o.description,
              'fornecedor_id', o.fornecedor_id,
              'fornecedor_name', f.name,
              'predicted_date', o.predicted_date,
              'value', o.value
            ) as orc, o.id
            FROM orcamentos o
            LEFT JOIN fornecedores f ON o.fornecedor_id = f.id
            WHERE o.projeto_id = p.id
            ORDER BY o.id
          ) sub),
          '[]'::json
        ) AS orcamentos,
        COALESCE(
          (SELECT JSON_AGG(sub.mem ORDER BY sub.id) FROM (
            SELECT DISTINCT ON (pm.id) JSON_BUILD_OBJECT(
              'cliente_id', pm.cliente_id,
              'empresa_id', pm.empresa_id,
              'grupo_id', pm.grupo_id,
              'cliente_name', c.name,
              'empresa_name', e.name,
              'grupo_name', g.name,
              'percentage', pm.percentage
            ) as mem, pm.id
            FROM projeto_members pm
            LEFT JOIN clientes c ON pm.cliente_id = c.id
            LEFT JOIN empresas e ON pm.empresa_id = e.id
            LEFT JOIN grupos g ON pm.grupo_id = g.id
            WHERE pm.projeto_id = p.id
            ORDER BY pm.id
          ) sub),
          '[]'::json
        ) AS members
      FROM projetos p
      ORDER BY p.created_at DESC;
    `,
  });
}

export default loadProjetos;
