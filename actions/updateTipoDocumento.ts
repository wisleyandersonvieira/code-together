import { action } from '@uibakery/data';

function updateTipoDocumento() {
  return action('updateTipoDocumento', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE tipos_documento 
      SET 
        descricao = {{params.descricao}}, 
        mascara = {{params.mascara}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default updateTipoDocumento;
