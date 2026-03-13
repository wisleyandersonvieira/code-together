import { action } from '@uibakery/data';

function extractContasReceberProjetos() {
  return action('extractContasReceberProjetos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM contas_receber_projetos
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractContasReceberProjetos;
