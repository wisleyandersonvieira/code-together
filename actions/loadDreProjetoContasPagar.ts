import { action } from '@uibakery/data';

function loadDreProjetoContasPagar() {
  return action('loadDreProjetoContasPagar', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT DISTINCT
        cp.id,
        cp.valor_total,
        COALESCE(cpr.valor_rateio, cp.valor_total) as valor_rateio,
        sc.id as subgrupo_contabil_id,
        sc.descricao as subgrupo_descricao,
        sc.funcao as subgrupo_funcao
      FROM contas_pagar cp
      LEFT JOIN contas_pagar_projetos cpr ON cp.id = cpr.conta_pagar_id
      LEFT JOIN projetos p ON cpr.projeto_id = p.id
      INNER JOIN produtos prod ON EXISTS (
        SELECT 1 FROM contas_pagar_itens cpi 
        WHERE cpi.conta_pagar_id = cp.id AND cpi.produto_id = prod.id
      )
      INNER JOIN subgrupos_contabeis sc ON prod.subgrupo_id = sc.id
      WHERE cp.matriz_id = {{params.matrizId}}
        AND (
          -- Se tem projeto vinculado, filtra por status
          (cpr.projeto_id IS NOT NULL AND (
            {{params.statusProjeto}} = 'Ambos' OR 
            p.status = {{params.statusProjeto}}
          ))
          OR
          -- Se não tem projeto vinculado, inclui os dados
          cpr.projeto_id IS NULL
        )
        AND (
          ({{params.tipoData}} = 'competencia' AND cp.data_competencia BETWEEN {{params.dataInicio}} AND {{params.dataFim}})
          OR
          ({{params.tipoData}} = 'pagamento' AND EXISTS (
            SELECT 1 FROM titulos_pagar tp 
            WHERE tp.conta_pagar_id = cp.id 
            AND tp.data_pagamento BETWEEN {{params.dataInicio}} AND {{params.dataFim}}
          ))
        )
      ORDER BY sc.id;
    `,
  });
}

export default loadDreProjetoContasPagar;
