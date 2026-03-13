import { action } from '@uibakery/data';

function deleteConta() {
  return action('deleteConta', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM contas 
      WHERE id = {{params.id}};
    `,
  });
}

export default deleteConta;
