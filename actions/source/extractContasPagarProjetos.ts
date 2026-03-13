import { action } from '@uibakery/data';

function extractContasPagarProjetos() {
  return action('extractContasPagarProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_pagar_projetos
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContasPagarProjetos;
