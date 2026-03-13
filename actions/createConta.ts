import { action } from '@uibakery/data';

function createConta() {
  return action('createConta', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas (
        nome, numero, banco, descricao, saldo_inicial, data_saldo_inicial, destaque
      ) VALUES (
        {{ params.nome ? "'" + params.nome + "'" : "NULL" }}, {{ params.numero ? "'" + params.numero + "'" : "NULL" }}, {{ params.banco ? "'" + params.banco + "'" : "NULL" }}, {{ params.descricao ? "'" + params.descricao + "'" : "NULL" }},
        {{params.saldoInicial || "NULL"}}, {{ params.dataSaldoInicial ? "'" + params.dataSaldoInicial + "'" : "NULL" }}, {{params.destaque || "false"}}
      ) RETURNING *;
    `,
  });
}

export default createConta;
