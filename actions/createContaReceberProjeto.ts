import { action } from '@uibakery/data';

function createContaReceberProjeto() {
  return action('createContaReceberProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_receber_projetos (conta_receber_id, projeto_id, percentual, valor_rateio)
      VALUES (
        {{params.conta_receber_id}}, 
        {{params.projeto_id}}, 
        {{params.percentual}}::numeric(5,2), 
        {{params.valor_rateio}}::numeric(15,2)
      );
    `,
  });
}

export default createContaReceberProjeto;
