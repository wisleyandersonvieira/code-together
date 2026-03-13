import { action } from '@uibakery/data';

function fixGruposSequence() {
  return action('fixGruposSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('grupos', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM grupos), false) as new_sequence_value;
    `,
  });
}

export default fixGruposSequence;
