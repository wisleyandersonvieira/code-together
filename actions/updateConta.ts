import { action } from '@uibakery/data';

function updateConta() {
  return action('updateConta', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE contas 
      SET nome = '{{ params.nome ? params.nome.replace(/'/g, "''") : "" }}',
          numero = '{{ params.numero ? params.numero.replace(/'/g, "''") : "" }}',
          banco = '{{ params.banco ? params.banco.replace(/'/g, "''") : "" }}',
          descricao = {{ params.descricao ? "'" + params.descricao.replace(/'/g, "''") + "'" : "NULL" }},
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
