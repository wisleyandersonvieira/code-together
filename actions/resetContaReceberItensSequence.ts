import { action } from '@uibakery/data';

function resetContaReceberItensSequence() {
  return action('resetContaReceberItensSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval('contas_receber_itens_id_seq', COALESCE((SELECT MAX(id) FROM contas_receber_itens), 1), false);
    `,
  });
}

export default resetContaReceberItensSequence;
