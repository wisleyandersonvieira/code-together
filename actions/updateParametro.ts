import { action } from '@uibakery/data';

function updateParametro() {
  return action('updateParametro', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE parametros 
      SET 
        valor = {{params.valor}},
        updated_at = CURRENT_TIMESTAMP
      WHERE chave = {{params.chave}}
      RETURNING id, chave, valor;
    `,
  });
}

export default updateParametro;
