import { action } from '@uibakery/data';

function fixProdutosSequence() {
  return action('fixProdutosSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('produtos', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM produtos), false) as new_sequence_value;
    `,
  });
}

export default fixProdutosSequence;
