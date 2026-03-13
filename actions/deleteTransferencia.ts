import { action } from '@uibakery/data';

function deleteTransferencia() {
  return action('deleteTransferencia', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM transferencias 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteTransferencia;
