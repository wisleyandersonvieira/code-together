import { action } from '@uibakery/data';

function loadRecentActivities() {
  return action('loadRecentActivities', 'SQL', {
    databaseName: 'provision',
    query: `
      (SELECT 'projeto' as type, name as title, created_at, id FROM projetos ORDER BY created_at DESC LIMIT 3)
      UNION ALL
      (SELECT 'cliente' as type, name as title, created_at, id FROM clientes ORDER BY created_at DESC LIMIT 3)
      UNION ALL
      (SELECT 'empresa' as type, name as title, created_at, id FROM empresas ORDER BY created_at DESC LIMIT 3)
      UNION ALL
      (SELECT 'grupo' as type, name as title, created_at, id FROM grupos ORDER BY created_at DESC LIMIT 3)
      ORDER BY created_at DESC
      LIMIT 10;
    `,
  });
}

export default loadRecentActivities;
