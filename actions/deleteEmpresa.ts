import { action } from '@uibakery/data';

function deleteEmpresa() {
  return action('deleteEmpresa', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Statement único (CTEs modificadoras): a edge function execute-sql aceita
      -- apenas um comando por requisição.
      WITH del_files AS (
        DELETE FROM files
        WHERE entity_id = {{params.id}} AND entity_type = 'empresa_document'
      ),
      del_empresa_clientes AS (
        DELETE FROM empresa_clientes WHERE empresa_id = {{params.id}}
      )
      DELETE FROM empresas WHERE id = {{params.id}}
      RETURNING id, name;
    `,
  });
}

export default deleteEmpresa;
