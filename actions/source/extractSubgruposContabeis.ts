import { action } from '@uibakery/data';

function extractSubgruposContabeis() {
  return action('extractSubgruposContabeis', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM subgrupos_contabeis
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractSubgruposContabeis;
