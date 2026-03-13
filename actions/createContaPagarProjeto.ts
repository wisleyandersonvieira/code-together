import { action } from '@uibakery/data';

function createContaPagarProjeto() {
  return action('createContaPagarProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_pagar_projetos (conta_pagar_id, projeto_id, percentual, valor_rateio)
      VALUES (
        {{params.conta_pagar_id}}, 
        {{params.projeto_id}}, 
        {{params.percentual}}::numeric(5,2), 
        {{params.valor_rateio}}::numeric(15,2)
      );
    `,
  });
}

export default createContaPagarProjeto;
