import { action } from '@uibakery/data';

function debugDreContasReceberItens() {
  return action('debugDreContasReceberItens', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Debug query para verificar valores duplicados no DRE
      SELECT 
        cr.id as conta_receber_id,
        cr.numero_documento,
        cr.valor_total as conta_valor_total,
        cri.id as item_id,
        cri.produto_id,
        p.descricao as produto_descricao,
        p.subgrupo_id,
        sg.nome as subgrupo_nome,
        sg.funcao as subgrupo_funcao,
        cri.quantidade,
        cri.valor_unitario,
        cri.valor_total as item_valor_total,
        -- Verificar se há múltiplos itens por conta
        (SELECT COUNT(*) FROM contas_receber_itens cri2 WHERE cri2.conta_receber_id = cr.id) as total_itens_na_conta
      FROM contas_receber cr
      INNER JOIN contas_receber_itens cri ON cri.conta_receber_id = cr.id
      INNER JOIN produtos p ON p.id = cri.produto_id
      INNER JOIN subgrupos_contabeis sg ON sg.id = p.subgrupo_id
      WHERE cr.id = {{params.contaReceberId}}
      ORDER BY cr.id, cri.id;
    `,
  });
}

export default debugDreContasReceberItens;
