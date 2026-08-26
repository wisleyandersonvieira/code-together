import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento, andProjetoIdIn, andProjetoStatus } from '@/lib/sql-filters';

function loadDreInfoDetalheContasPagar() {
  return action('loadDreInfoDetalheContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        cp.id,
        f.name as favorecido,
        COALESCE(cp.observacoes, '') as observacao,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN cp.data_competencia::text
          ELSE MIN(tp.data_pagamento)::text
        END as data_referencia,
        SUM(
          CASE
            WHEN '{{params.tipoData}}' = 'competencia' THEN (tp.valor * cpi.valor_total / NULLIF(cp.valor_total, 0))
            ELSE (tp.valor_pago * cpi.valor_total / NULLIF(cp.valor_total, 0))
          END
        ) as valor,
        COALESCE(STRING_AGG(DISTINCT proj.name, ', '), '') as projetos
      FROM contas_pagar cp
      INNER JOIN titulos_pagar tp ON tp.conta_pagar_id = cp.id
      INNER JOIN contas_pagar_itens cpi ON cpi.conta_pagar_id = cp.id
      INNER JOIN produtos prod ON prod.id = cpi.produto_id
      INNER JOIN subgrupos_contabeis sg ON sg.id = prod.subgrupo_id
      INNER JOIN fornecedores f ON f.id = cp.fornecedor_id
      LEFT JOIN contas_pagar_projetos cpp2 ON cpp2.conta_pagar_id = cp.id
      LEFT JOIN projetos proj ON proj.id = cpp2.projeto_id
      WHERE
        1=1
        ${andIdIn('cp.matriz_id', 'matrizIds')}
        AND sg.id = {{params.subgrupoId}}
        AND (
          ('{{params.tipoData}}' = 'competencia' AND cp.data_competencia BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}')
          OR
          ('{{params.tipoData}}' = 'pagamento' AND tp.data_pagamento BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}' AND tp.status = 'PAGO' AND tp.valor_pago IS NOT NULL AND tp.valor_pago > 0)
        )
        ${andProjetoIdIn('cp.id', 'contas_pagar_projetos', 'conta_pagar_id')}
        ${andProjetoStatus('cp.id', 'contas_pagar_projetos', 'conta_pagar_id')}
        ${andIdInWhenPagamento('tp.conta_id', 'contaIds')}
      GROUP BY cp.id, f.name, cp.observacoes, cp.data_competencia
      ORDER BY data_referencia ASC, cp.id ASC
    `,
  });
}

export default loadDreInfoDetalheContasPagar;
