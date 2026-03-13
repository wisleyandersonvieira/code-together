import { action } from '@uibakery/data';

function fixTempCodigos() {
  return action('fixTempCodigos', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE produtos 
      SET codigo = LPAD(id::text, 6, '0')
      WHERE codigo = 'TEMP'
      RETURNING *;
    `,
  });
}

export default fixTempCodigos;

