import { action } from '@uibakery/data';

function fixFornecedoresSequence() {
  return action('fixFornecedoresSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('fornecedores', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM fornecedores), false) as new_sequence_value;
    `,
  });
}

export default fixFornecedoresSequence;
