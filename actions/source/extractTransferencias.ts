import { action } from '@uibakery/data';

function extractTransferencias() {
  return action('extractTransferencias', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT * FROM transferencias
      ORDER BY id
      LIMIT {{params.limit || 1000}}
      OFFSET {{params.offset || 0}};
    `,
  });
}

export default extractTransferencias;
