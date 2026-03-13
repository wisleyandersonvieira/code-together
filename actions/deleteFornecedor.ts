import { action } from '@uibakery/data';

function deleteFornecedor() {
  return action('deleteFornecedor', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM fornecedores WHERE id = {{params.id}};
    `,
  });
}

export default deleteFornecedor;
