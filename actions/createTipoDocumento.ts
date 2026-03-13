import { action } from '@uibakery/data';

function createTipoDocumento() {
  return action('createTipoDocumento', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO tipos_documento (codigo, descricao, mascara)
      VALUES (
        LPAD((COALESCE((SELECT MAX(codigo::integer) FROM tipos_documento WHERE codigo ~ '^[0-9]+$'), 0) + 1)::text, 6, '0'),
        '{{params.descricao}}', 
        '{{params.mascara}}'
      )
      RETURNING *;
    `,
  });
}

export default createTipoDocumento;
