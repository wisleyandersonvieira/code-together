import { action } from '@uibakery/data';

function deleteContaReceber() {
  return action('deleteContaReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Statement único (CTEs modificadoras): a edge function execute-sql aceita
      -- apenas um comando por requisição. Os relacionados são apagados na mesma
      -- instrução, antes da checagem de FK que ocorre ao fim do statement.
      WITH del_titulos AS (
        DELETE FROM titulos_receber WHERE conta_receber_id = {{params.id}}
      ),
      del_faturamento AS (
        DELETE FROM contas_receber_faturamento WHERE conta_receber_id = {{params.id}}
      ),
      del_projetos AS (
        DELETE FROM contas_receber_projetos WHERE conta_receber_id = {{params.id}}
      ),
      del_itens AS (
        DELETE FROM contas_receber_itens WHERE conta_receber_id = {{params.id}}
      ),
      del_rateio AS (
        DELETE FROM rateio_aportes WHERE conta_receber_id = {{params.id}}
      )
      DELETE FROM contas_receber WHERE id = {{params.id}};
    `,
  });
}

export default deleteContaReceber;
