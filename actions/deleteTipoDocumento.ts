import { action } from '@uibakery/data';

function deleteTipoDocumento() {
  return action('deleteTipoDocumento', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM tipos_documento WHERE id = {{params.id}};
    `,
  });
}

export default deleteTipoDocumento;
