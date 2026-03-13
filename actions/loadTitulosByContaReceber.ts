import { action } from '@uibakery/data';

function loadTitulosByContaReceber() {
  return action('loadTitulosByContaReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT tr.*, c.nome as conta_nome, c.banco
      FROM titulos_receber tr
      LEFT JOIN contas c ON tr.conta_id = c.id
      WHERE tr.conta_receber_id = {{params.contaReceberId}}
      ORDER BY tr.parcela, tr.data_vencimento;
    `,
  });
}

export default loadTitulosByContaReceber;
