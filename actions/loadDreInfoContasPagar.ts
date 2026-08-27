import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento, andProjetoIdIn, andProjetoStatus, fracoesStatusProjeto } from '@/lib/sql-filters';


function loadDreInfoContasPagar() {
  return action('loadDreInfoContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        CONCAT('titulo_', tp.id, '_item_', cpi.id) as id,
        cp.matriz_id,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN (tp.valor * cpi.valor_total / NULLIF(cp.valor_total, 0))
          ELSE (tp.valor_pago * cpi.valor_total / NULLIF(cp.valor_total, 0))
        END as valor_total,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN cp.data_competencia
          ELSE tp.data_pagamento
        END as data_referencia,
        sg.id as subgrupo_contabil_id,
        sg.funcao
      FROM contas_pagar cp
      INNER JOIN titulos_pagar tp ON tp.conta_pagar_id = cp.id
      INNER JOIN contas_pagar_itens cpi ON cpi.conta_pagar_id = cp.id
      INNER JOIN produtos p ON p.id = cpi.produto_id
      INNER JOIN subgrupos_contabeis sg ON sg.id = p.subgrupo_id
      INNER JOIN estruturas_dre_itens edi ON edi.subgrupo_contabil_id = sg.id AND edi.estrutura_dre_id = {{params.estruturaId}}
      WHERE
        1=1
        ${andIdIn('cp.matriz_id', 'matrizIds')}
        ${andProjetoIdIn('cp.id', 'contas_pagar_projetos', 'conta_pagar_id')}
        ${andProjetoStatus('cp.id', 'contas_pagar_projetos', 'conta_pagar_id')}
        ${andIdInWhenPagamento('tp.conta_id', 'contaIds')}
        AND (
          ('{{params.tipoData}}' = 'competencia' AND cp.data_competencia BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}')
          OR
          ('{{params.tipoData}}' = 'pagamento' AND tp.data_pagamento BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}' AND tp.status = 'PAGO' AND tp.valor_pago IS NOT NULL AND tp.valor_pago > 0)
        );
    `,
  });
}

export default loadDreInfoContasPagar;
