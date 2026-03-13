import { action } from '@uibakery/data';

function createEstruturaDre() {
  return action('createEstruturaDre', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO estruturas_dre (nome)
      VALUES ('{{params.nome}}')
      RETURNING id, nome, created_at, updated_at;
    `,
  });
}

export default createEstruturaDre;
