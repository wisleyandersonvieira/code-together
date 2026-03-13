import { action } from '@uibakery/data';

function loadSocios() {
  return action('loadSocios', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id,
        nome,
        email,
        telefone,
        cpf,
        data_nascimento,
        endereco,
        created_at,
        updated_at
      FROM socios
      WHERE 1 = 1
      {{ params && params.searchNome ? "AND nome ILIKE '%" + params.searchNome + "%'" : "" }}
      ORDER BY nome;
    `,
  });
}

export default loadSocios;

