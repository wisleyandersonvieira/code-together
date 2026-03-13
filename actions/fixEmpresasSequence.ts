import { action } from '@uibakery/data';

function fixEmpresasSequence() {
  return action('fixEmpresasSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('empresas', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM empresas), false) as new_sequence_value;
    `,
  });
}

export default fixEmpresasSequence;
