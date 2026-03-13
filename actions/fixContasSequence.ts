import { action } from '@uibakery/data';

function fixContasSequence() {
  return action('fixContasSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('contas', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM contas), false) as new_sequence_value;
    `,
  });
}

export default fixContasSequence;
