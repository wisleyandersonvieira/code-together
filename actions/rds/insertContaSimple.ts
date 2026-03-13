import { action } from '@uibakery/data';

function insertContaSimple() {
  return action('insertContaSimple', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas (id, nome, numero, banco, saldo_inicial, data_saldo_inicial, destaque, descricao)
      VALUES ({{params.id}}, '{{params.nome || params.name || ""}}', '{{params.numero || params.codigo || ""}}', '{{params.banco || ""}}', {{params.saldo_inicial || "NULL"}}, {{params.data_saldo_inicial ? "'" + params.data_saldo_inicial + "'" : "NULL"}}, {{params.destaque !== undefined ? params.destaque : false}}, '{{params.descricao || ""}}')
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        numero = EXCLUDED.numero,
        banco = EXCLUDED.banco,
        saldo_inicial = EXCLUDED.saldo_inicial,
        data_saldo_inicial = EXCLUDED.data_saldo_inicial,
        destaque = EXCLUDED.destaque,
        descricao = EXCLUDED.descricao,
        updated_at = CURRENT_TIMESTAMP;
    `,
  });
}

export default insertContaSimple;
