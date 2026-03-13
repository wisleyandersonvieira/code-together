import { action } from '@uibakery/data';

function fixProdutosIdSequence() {
  return action('fixProdutosIdSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval('produtos_id_seq', (SELECT MAX(id) FROM produtos), true) as new_sequence_value;
    `,
  });
}

export default fixProdutosIdSequence;
