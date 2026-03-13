import { action } from '@uibakery/data';

function loadProjetoMembers() {
  return action('loadProjetoMembers', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pm.id,
        pm.projeto_id,
        pm.cliente_id,
        pm.empresa_id,
        pm.grupo_id,
        pm.percentage,
        COALESCE(c.name, e.name, g.name) as nome
      FROM projeto_members pm
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      WHERE pm.projeto_id = {{params.projetoId}}
      ORDER BY nome;
    `,
  });
}

export default loadProjetoMembers;
