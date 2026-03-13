import { action } from '@uibakery/data';

function loadProjetosAtivos() {
  return action('loadProjetosAtivos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        p.id, 
        p.name, 
        p.address, 
        p.city, 
        p.status,
        p.created_at, 
        p.updated_at
      FROM projetos p
      WHERE p.status != 'Concluído'
      ORDER BY p.created_at DESC;
    `,
  });
}

export default loadProjetosAtivos;
