import { action } from '@uibakery/data';

function createContaReceberFaturamento() {
  return action('createContaReceberFaturamento', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_receber_faturamento (
        conta_receber_id, 
        projeto_id, 
        valor_faturamento, 
        observacoes
      ) VALUES (
        {{params.contaReceberId}}, 
        {{params.projetoId}}, 
        {{params.valorFaturamento}}::numeric(15,2), 
        '{{params.observacoes}}'
      ) RETURNING *;
    `,
  });
}

export default createContaReceberFaturamento;
