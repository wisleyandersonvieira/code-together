import { action } from '@uibakery/data';

function loadContaReceberItens() {
  return action('loadContaReceberItens', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT cri.*, p.descricao as produto_descricao
      FROM contas_receber_itens cri
      JOIN produtos p ON cri.produto_id = p.id
      WHERE cri.conta_receber_id = {{params.contaReceberId}}
      ORDER BY cri.id;
    `,
  });
}

export default loadContaReceberItens;
