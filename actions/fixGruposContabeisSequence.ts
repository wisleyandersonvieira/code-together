import { action } from '@uibakery/data';

function fixGruposContabeisSequence() {
  return action('fixGruposContabeisSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('grupos_contabeis', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM grupos_contabeis), false) as new_sequence_value;
    `,
  });
}

export default fixGruposContabeisSequence;
