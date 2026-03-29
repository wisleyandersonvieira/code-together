import { action } from '@uibakery/data';

function loadDreInfoDetalheContasReceber() {
  return action('loadDreInfoDetalheContasReceber', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        cr.id,
        COALESCE(
          CASE
            WHEN cr.entity_type = 'cliente' THEN cli_entity.name
            WHEN cr.entity_type = 'empresa' THEN e.name
            WHEN cr.entity_type = 'grupo' THEN grp.name
            ELSE cli_legacy.name
          END,
          cli_legacy.name,
          'N/A'
        ) as favorecido,
        COALESCE(cr.observacoes, '') as observacao,
        CASE
          WHEN '{{params.tipoData}}' = 'competencia' THEN cr.data_competencia::text
          ELSE MIN(tr.data_recebimento)::text
        END as data_referencia,
        SUM(
          CASE
            WHEN '{{params.tipoData}}' = 'competencia' THEN (tr.valor * cri.valor_total / NULLIF(cr.valor_total, 0))
            ELSE (tr.valor_recebido * cri.valor_total / NULLIF(cr.valor_total, 0))
          END
        ) as valor
      FROM contas_receber cr
      INNER JOIN titulos_receber tr ON tr.conta_receber_id = cr.id
      INNER JOIN contas_receber_itens cri ON cri.conta_receber_id = cr.id
      INNER JOIN produtos prod ON prod.id = cri.produto_id
      INNER JOIN subgrupos_contabeis sg ON sg.id = prod.subgrupo_id
      LEFT JOIN clientes cli_legacy ON cli_legacy.id = cr.cliente_id
      LEFT JOIN clientes cli_entity ON cr.entity_type = 'cliente' AND cr.entity_id = cli_entity.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos grp ON cr.entity_type = 'grupo' AND cr.entity_id = grp.id
      WHERE
        cr.matriz_id = {{params.matrizId}}
        AND sg.id = {{params.subgrupoId}}
        AND (
          ('{{params.tipoData}}' = 'competencia' AND cr.data_competencia BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}')
          OR
          ('{{params.tipoData}}' = 'pagamento' AND tr.data_recebimento BETWEEN '{{params.dataInicio}}' AND '{{params.dataFim}}' AND tr.status = 'RECEBIDO' AND tr.valor_recebido IS NOT NULL AND tr.valor_recebido > 0)
        )
        {{ params.projetoId ? "AND EXISTS (SELECT 1 FROM contas_receber_projetos crp WHERE crp.conta_receber_id = cr.id AND crp.projeto_id = " + params.projetoId + ")" : "" }}
      GROUP BY cr.id, cli_legacy.name, cli_entity.name, e.name, grp.name, cr.entity_type, cr.observacao, cr.data_competencia
      ORDER BY data_referencia ASC, cr.id ASC
    `,
  });
}

export default loadDreInfoDetalheContasReceber;
