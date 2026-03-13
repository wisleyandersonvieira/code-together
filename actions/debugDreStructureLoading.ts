import { action } from '@uibakery/data';

function debugDreStructureLoading() {
  return action('debugDreStructureLoading', 'SQL', {
    databaseName: 'provision',
    query: `SELECT * FROM estruturas_dre_itens ORDER BY estrutura_dre_id, ordem LIMIT 100;`,
  });
}

export default debugDreStructureLoading;
