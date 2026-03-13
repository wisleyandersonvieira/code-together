import { action } from '@uibakery/data';

function deleteCliente() {
  return action('deleteCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM clientes WHERE id = {{params.id}};
    `,
  });
}

export default deleteCliente;
