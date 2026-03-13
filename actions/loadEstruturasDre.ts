import { action } from '@uibakery/data';

function loadEstruturasDre() {
  return action('loadEstruturasDre', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id, nome, created_at, updated_at
      FROM estruturas_dre
      ORDER BY created_at DESC;
    `,
  });
}

export default loadEstruturasDre;
