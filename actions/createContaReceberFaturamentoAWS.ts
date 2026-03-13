import { action } from '@uibakery/data';

function createContaReceberFaturamentoAWS() {
  return action('createContaReceberFaturamentoAWS', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas_receber_faturamento (
        conta_receber_id, 
        projeto_id, 
        valor_faturamento, 
        observacoes
      ) VALUES (
        {{ contaReceberId }}, 
        {{ projetoId }}, 
        {{ valorFaturamento }}, 
        {{ observacoes }}
      ) RETURNING *;
    `,
  });
}

export default createContaReceberFaturamentoAWS;
