import { action } from '@uibakery/data';

function debugProdutoExclusao() {
  return action('debugProdutoExclusao', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Verificar produtos e suas dependências
      SELECT 
        p.id,
        p.codigo,
        p.descricao,
        p.tipo,
        (SELECT COUNT(*) FROM contas_pagar_itens cpi WHERE cpi.produto_id = p.id) as contas_pagar_count,
        (SELECT COUNT(*) FROM contas_receber_itens cri WHERE cri.produto_id = p.id) as contas_receber_count,
        CASE 
          WHEN EXISTS (SELECT 1 FROM contas_pagar_itens cpi WHERE cpi.produto_id = p.id) OR
               EXISTS (SELECT 1 FROM contas_receber_itens cri WHERE cri.produto_id = p.id)
          THEN 'HAS_DEPENDENCIES'
          ELSE 'CAN_DELETE'
        END as status
      FROM produtos p
      ORDER BY p.id;
    `,
  });
}

export default debugProdutoExclusao;
