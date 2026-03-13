import { action } from '@uibakery/data';

function fixSubgruposContabeisSequence() {
  return action('fixSubgruposContabeisSequence', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT setval(pg_get_serial_sequence('subgrupos_contabeis', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM subgrupos_contabeis), false) as new_sequence_value;
    `,
  });
}

export default fixSubgruposContabeisSequence;
