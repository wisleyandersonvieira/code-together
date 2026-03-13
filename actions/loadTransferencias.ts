import { action } from '@uibakery/data';

function loadTransferencias() {
  return action('loadTransferencias', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        t.*,
        co.nome as conta_origem_nome,
        co.banco as conta_origem_banco,
        cd.nome as conta_destino_nome,
        cd.banco as conta_destino_banco
      FROM transferencias t
      INNER JOIN contas co ON t.conta_origem_id = co.id
      INNER JOIN contas cd ON t.conta_destino_id = cd.id
      WHERE 1 = 1
      {{ params.contaId ? "AND (t.conta_origem_id = " + params.contaId + " OR t.conta_destino_id = " + params.contaId + ")" : "" }}
      {{ params.dataInicio ? "AND t.data_transferencia >= '" + params.dataInicio + "'" : "" }}
      {{ params.dataFim ? "AND t.data_transferencia <= '" + params.dataFim + "'" : "" }}
      ORDER BY t.data_transferencia DESC, t.created_at DESC;
    `,
  });
}

export default loadTransferencias;
