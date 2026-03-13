import { action } from '@uibakery/data';

function createMatriz() {
  return action('createMatriz', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO matrizes (nome, cnpj_ein, endereco)
      VALUES ('{{params.nome}}', '{{params.cnpjEin}}', '{{params.endereco}}')
      RETURNING id;
    `,
  });
}

export default createMatriz;
