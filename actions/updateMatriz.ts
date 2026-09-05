import { action } from '@uibakery/data';

function updateMatriz() {
  return action('updateMatriz', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE matrizes 
      SET 
        nome = {{params.nome ? "'" + params.nome + "'" : "NULL"}},
        cnpj_ein = {{params.cnpjEin ? "'" + params.cnpjEin + "'" : "NULL"}},
        endereco = {{params.endereco ? "'" + params.endereco + "'" : "NULL"}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default updateMatriz;
