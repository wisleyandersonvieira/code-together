import { action } from '@uibakery/data';

function deleteEmpresa() {
  return action('deleteEmpresa', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Excluir arquivos relacionados à empresa
      DELETE FROM files WHERE entity_id = {{params.id}} AND entity_type = 'empresa_document';
      
      -- Excluir relacionamentos empresa-clientes
      DELETE FROM empresa_clientes WHERE empresa_id = {{params.id}};
      
      -- Excluir a empresa
      DELETE FROM empresas WHERE id = {{params.id}}
      RETURNING id, name;
    `,
  });
}

export default deleteEmpresa;
