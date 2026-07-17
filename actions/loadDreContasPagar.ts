import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento, fatorRateioStatus } from '@/lib/sql-filters';

function loadDreContasPagar() {
  return action('loadDreContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        CASE 
          WHEN '{{params.tipoData}}' = 'competencia' THEN CONCAT('titulo_', tp.id, '_item_', cpi.id)
          ELSE CONCAT('titulo_', tp.id, '_item_', cpi.id)
        END as id,
        cp.matriz_id,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN (tp.valor * cpi.valor_total / NULLIF(cp.valor_total, 0))
          ELSE (tp.valor_pago * cpi.valor_total / NULLIF(cp.valor_total, 0))
        END${fatorRateioStatus('cp.id', 'contas_pagar_projetos', 'conta_pagar_id')} as valor_total,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN cp.data_competencia
          ELSE tp.data_pagamento
        END as data_referencia,
        sg.id as subgrupo_contabil_id,
        sg.funcao,
        cp.numero_documento,
        f.name as fornecedor_nome,
        p.descricao as produto_nome
      FROM contas_pagar cp
      INNER JOIN titulos_pagar tp ON tp.conta_pagar_id = cp.id
      INNER JOIN contas_pagar_itens cpi ON cpi.conta_pagar_id = cp.id
      INNER JOIN produtos p ON p.id = cpi.produto_id
      -- LEFT JOIN apenas de exibição (drill-down): não pode alterar a contagem
      -- de linhas nem, portanto, o valor somado.
      LEFT JOIN fornecedores f ON f.id = cp.fornecedor_id
      INNER JOIN subgrupos_contabeis sg ON sg.id = p.subgrupo_id
      INNER JOIN estruturas_dre_itens edi ON edi.subgrupo_contabil_id = sg.id AND edi.estrutura_dre_id = {{params.estruturaId}}
      WHERE
        1 = 1
        ${andIdIn('cp.matriz_id', 'matrizIds')}
        AND (
          ('{{params.tipoData}}' = 'competencia' AND cp.data_competencia BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}')
          OR
          ('{{params.tipoData}}' = 'pagamento' AND tp.data_pagamento BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}' AND tp.status = 'PAGO' AND tp.valor_pago IS NOT NULL AND tp.valor_pago > 0
            ${andIdInWhenPagamento('tp.conta_id', 'contaIds')})
        );
    `,
  });
}

export default loadDreContasPagar;
