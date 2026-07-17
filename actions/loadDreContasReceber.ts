import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento } from '@/lib/sql-filters';

function loadDreContasReceber() {
  return action('loadDreContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        CASE 
          WHEN '{{params.tipoData}}' = 'competencia' THEN CONCAT('titulo_', tr.id, '_item_', cri.id)
          ELSE CONCAT('titulo_', tr.id, '_item_', cri.id)
        END as id,
        cr.matriz_id,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN (tr.valor * cri.valor_total / NULLIF(cr.valor_total, 0))
          ELSE (tr.valor_recebido * cri.valor_total / NULLIF(cr.valor_total, 0))
        END as valor_total,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN cr.data_competencia
          ELSE tr.data_recebimento
        END as data_referencia,
        sg.id as subgrupo_contabil_id,
        sg.funcao
      FROM contas_receber cr
      INNER JOIN titulos_receber tr ON tr.conta_receber_id = cr.id
      INNER JOIN contas_receber_itens cri ON cri.conta_receber_id = cr.id
      INNER JOIN produtos p ON p.id = cri.produto_id
      INNER JOIN subgrupos_contabeis sg ON sg.id = p.subgrupo_id
      INNER JOIN estruturas_dre_itens edi ON edi.subgrupo_contabil_id = sg.id AND edi.estrutura_dre_id = {{params.estruturaId}}
      WHERE
        1 = 1
        ${andIdIn('cr.matriz_id', 'matrizIds')}
        AND (
          ('{{params.tipoData}}' = 'competencia' AND cr.data_competencia BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}')
          OR
          ('{{params.tipoData}}' = 'pagamento' AND tr.data_recebimento BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}' AND tr.status = 'RECEBIDO' AND tr.valor_recebido IS NOT NULL AND tr.valor_recebido > 0
            ${andIdInWhenPagamento('tr.conta_id', 'contaIds')})
        );
    `,
  });
}

export default loadDreContasReceber;
