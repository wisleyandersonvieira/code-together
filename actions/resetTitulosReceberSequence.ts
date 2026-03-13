import { action } from '@uibakery/data';

function resetTitulosReceberSequence() {
  return action('resetTitulosReceberSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval('titulos_receber_id_seq', COALESCE((SELECT MAX(id) FROM titulos_receber), 1), false);
    `,
  });
}

export default resetTitulosReceberSequence;
