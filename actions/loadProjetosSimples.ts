import { action } from '@uibakery/data';

// Lista leve de todos os projetos (inclusive concluídos), usada para exibir
// corretamente projetos já vinculados em contas a pagar/receber.
function loadProjetosSimples() {
  return action('loadProjetosSimples', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT p.id, p.name, p.status
      FROM projetos p
      ORDER BY p.name ASC;
    `,
  });
}

export default loadProjetosSimples;
