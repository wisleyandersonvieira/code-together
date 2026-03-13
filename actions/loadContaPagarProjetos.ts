import { action } from '@uibakery/data';

function loadContaPagarProjetos() {
  return action('loadContaPagarProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT *
      FROM contas_pagar_projetos
      WHERE conta_pagar_id = {{params.contaPagarId}}
      ORDER BY id;
    `,
  });
}

export default loadContaPagarProjetos;
