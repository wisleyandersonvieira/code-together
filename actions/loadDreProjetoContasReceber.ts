import { action } from '@uibakery/data';

function loadDreProjetoContasReceber() {
  return action('loadDreProjetoContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH receitas_projetos AS (
        -- Receitas por rateio tradicional
        SELECT 
          cr.id as conta_receber_id,
          p.id as projeto_id,
          p.status as projeto_status,
          crp.valor_rateio,
          0 as valor_faturamento,
          sc.id as subgrupo_contabil_id,
          sc.descricao as subgrupo_descricao,
          sc.funcao as subgrupo_funcao
        FROM contas_receber cr
        INNER JOIN contas_receber_projetos crp ON cr.id = crp.conta_receber_id
        INNER JOIN projetos p ON crp.projeto_id = p.id
        INNER JOIN contas_receber_itens cri ON cri.conta_receber_id = cr.id
        INNER JOIN produtos prod ON cri.produto_id = prod.id
        INNER JOIN subgrupos_contabeis sc ON prod.subgrupo_id = sc.id
        WHERE cr.matriz_id = {{params.matrizId}}
          AND (
            {{params.tipoData}} = 'competencia' AND cr.data_competencia BETWEEN {{params.dataInicio}} AND {{params.dataFim}}
            OR
            {{params.tipoData}} = 'pagamento' AND EXISTS (
              SELECT 1 FROM titulos_receber tr 
              WHERE tr.conta_receber_id = cr.id 
              AND tr.status = 'RECEBIDO'
              AND tr.data_recebimento BETWEEN {{params.dataInicio}} AND {{params.dataFim}}
            )
          )
          AND (
            {{params.statusProjeto}} = 'Ambos' OR 
            p.status = {{params.statusProjeto}}
          )
        
        UNION ALL
        
        -- Receitas por modo Faturamento
        SELECT 
          cr.id as conta_receber_id,
          p.id as projeto_id,
          p.status as projeto_status,
          0 as valor_rateio,
          crf.valor_faturamento,
          sc.id as subgrupo_contabil_id,
          sc.descricao as subgrupo_descricao,
          sc.funcao as subgrupo_funcao
        FROM contas_receber cr
        INNER JOIN contas_receber_faturamento crf ON cr.id = crf.conta_receber_id
        INNER JOIN projetos p ON crf.projeto_id = p.id
        INNER JOIN contas_receber_itens cri ON cri.conta_receber_id = cr.id
        INNER JOIN produtos prod ON cri.produto_id = prod.id
        INNER JOIN subgrupos_contabeis sc ON prod.subgrupo_id = sc.id
        WHERE cr.matriz_id = {{params.matrizId}}
          AND EXISTS (
            SELECT 1 FROM titulos_receber tr 
            WHERE tr.conta_receber_id = cr.id 
            AND tr.status = 'RECEBIDO'
            {{ params.tipoData === 'pagamento' ? "AND tr.data_recebimento BETWEEN '" + params.dataInicio + "' AND '" + params.dataFim + "'" : "" }}
          )
          AND (
            {{params.tipoData}} = 'competencia' AND cr.data_competencia BETWEEN {{params.dataInicio}} AND {{params.dataFim}}
            OR
            {{params.tipoData}} = 'pagamento' AND EXISTS (
              SELECT 1 FROM titulos_receber tr 
              WHERE tr.conta_receber_id = cr.id 
              AND tr.status = 'RECEBIDO'
              AND tr.data_recebimento BETWEEN {{params.dataInicio}} AND {{params.dataFim}}
            )
          )
          AND (
            {{params.statusProjeto}} = 'Ambos' OR 
            p.status = {{params.statusProjeto}}
          )
      )
      SELECT 
        conta_receber_id,
        projeto_id,
        SUM(valor_rateio + valor_faturamento) as valor_rateio,
        subgrupo_contabil_id,
        subgrupo_descricao,
        subgrupo_funcao
      FROM receitas_projetos
      GROUP BY conta_receber_id, projeto_id, subgrupo_contabil_id, subgrupo_descricao, subgrupo_funcao
      ORDER BY subgrupo_contabil_id;
    `,
  });
}

export default loadDreProjetoContasReceber;
