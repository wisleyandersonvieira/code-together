import { action } from '@uibakery/data';

function updateConta() {
  return action('updateConta', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE contas 
      SET nome = '{{ params.nome ? params.nome : "" }}',
          numero = '{{ params.numero ? params.numero : "" }}',
          banco = '{{ params.banco ? params.banco : "" }}',
          descricao = {{ params.descricao ? "'" + params.descricao + "'" : "NULL" }},
          saldo_inicial = {{params.saldoInicial}},
          data_saldo_inicial = '{{params.dataSaldoInicial}}',
          destaque = {{params.destaque}},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = {{params.id}}
      RETURNING *;
    `,
  });
}

export default updateConta;
