import { action } from '@uibakery/data';

function updateMatriz() {
  return action('updateMatriz', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE matrizes 
      SET 
        nome = {{params.nome ? "'" + params.nome.replace(/'/g, "''") + "'" : "NULL"}},
        cnpj_ein = {{params.cnpjEin ? "'" + params.cnpjEin.replace(/'/g, "''") + "'" : "NULL"}},
        endereco = {{params.endereco ? "'" + params.endereco.replace(/'/g, "''") + "'" : "NULL"}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default updateMatriz;
