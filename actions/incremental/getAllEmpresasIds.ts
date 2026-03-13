import { action } from '@uibakery/data';

function getAllEmpresasIds() {
  return action('getAllEmpresasIds', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT id FROM empresas 
      ORDER BY id;
    `,
  });
}

export default getAllEmpresasIds;
