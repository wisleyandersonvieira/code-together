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
        sg.funcao,
        cr.numero_documento,
        -- Contraparte polimórfica: entity_type/entity_id (cliente|empresa|grupo),
        -- com fallback para o cliente_id legado. Mesma regra de loadContasReceber.
        COALESCE(
          CASE
            WHEN cr.entity_type = 'cliente' THEN cl.name
            WHEN cr.entity_type = 'empresa' THEN e.name
            WHEN cr.entity_type = 'grupo' THEN g.name
            ELSE c.name
          END,
          c.name
        ) as fornecedor_nome,
        p.descricao as produto_nome
      FROM contas_receber cr
      INNER JOIN titulos_receber tr ON tr.conta_receber_id = cr.id
      INNER JOIN contas_receber_itens cri ON cri.conta_receber_id = cr.id
      INNER JOIN produtos p ON p.id = cri.produto_id
      -- LEFT JOINs apenas de exibição (drill-down): não podem alterar a
      -- contagem de linhas nem, portanto, o valor somado.
      LEFT JOIN clientes c ON cr.cliente_id = c.id
      LEFT JOIN clientes cl ON cr.entity_type = 'cliente' AND cr.entity_id = cl.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
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
