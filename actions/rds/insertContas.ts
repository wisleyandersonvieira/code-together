import { action } from '@uibakery/data';

function insertContas() {
  return action('insertContas', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO contas (id, nome, numero, banco, saldo_inicial, data_saldo_inicial, created_at, updated_at, descricao, destaque)
      VALUES {{ 
        params.contas.map(c => 
          "(" + 
          c.id + ", " +
          (c.nome ? "'" + c.nome.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.numero ? "'" + c.numero.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.banco ? "'" + c.banco.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.saldo_inicial !== null ? c.saldo_inicial : "0") + ", " +
          (c.data_saldo_inicial ? "'" + c.data_saldo_inicial + "'" : "NULL") + ", " +
          (c.created_at ? "'" + c.created_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (c.updated_at ? "'" + c.updated_at + "'" : "CURRENT_TIMESTAMP") + ", " +
          (c.descricao ? "'" + c.descricao.replace(/'/g, "''") + "'" : "NULL") + ", " +
          (c.destaque !== undefined ? c.destaque : "false") +
          ")"
        ).join(', ') 
      }}
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        numero = EXCLUDED.numero,
        banco = EXCLUDED.banco,
        saldo_inicial = EXCLUDED.saldo_inicial,
        data_saldo_inicial = EXCLUDED.data_saldo_inicial,
        updated_at = CURRENT_TIMESTAMP,
        descricao = EXCLUDED.descricao,
        destaque = EXCLUDED.destaque;
    `,
  });
}

export default insertContas;
