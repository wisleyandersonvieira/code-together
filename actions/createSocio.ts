import { action } from '@uibakery/data';

function createSocio() {
  return action('createSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO socios (nome, email, telefone, cpf, data_nascimento, endereco)
      VALUES ('{{params.nome}}', '{{params.email}}', '{{params.telefone}}', '{{params.cpf}}', '{{params.dataNascimento}}', '{{params.endereco}}')
      RETURNING id;
    `,
  });
}

export default createSocio;
