import { action } from '@uibakery/data';

function updateSocio() {
  return action('updateSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE socios 
      SET 
        nome = {{params.nome}},
        email = {{params.email}},
        telefone = {{params.telefone}},
        cpf = {{params.cpf}},
        data_nascimento = {{params.dataNascimento}},
        endereco = {{params.endereco}},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}};
    `,
  });
}

export default updateSocio;
