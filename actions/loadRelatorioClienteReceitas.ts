import { action } from '@uibakery/data';

function loadRelatorioClienteReceitas() {
  return action('loadRelatorioClienteReceitas', 'SQL', {
    databaseName: 'provision',
    query: `
      -- CTE com DISTINCT ON (tr.id) para evitar duplicação quando um título está
      -- vinculado a múltiplos projetos via contas_receber_projetos ou contas_receber_faturamento.
      WITH dedup AS (
        SELECT DISTINCT ON (tr.id)
          tr.id            AS titulo_id,
          tr.data_vencimento,
          tr.data_recebimento,
          p.name           AS projeto_nome,
          CASE 
            WHEN crp_direct.percentual IS NOT NULL 
              THEN ROUND(tr.valor * crp_direct.percentual / 100.0, 2)
            ELSE tr.valor
          END              AS valor,
          c.nome           AS conta_nome,
          tr.parcela,
          tr.total_parcelas,
          tr.status,
          CASE
            WHEN tr.status = 'RECEBIDO' THEN 'Quitada'
            ELSE 'Pendente'
          END              AS situacao_pagamento,
          cr.numero_documento,
          COALESCE(
            CASE
              WHEN cr.entity_type = 'cliente' THEN cl_entity.id
              WHEN cr.entity_type = 'empresa' THEN (
                SELECT ec.cliente_id
                FROM empresa_clientes ec
                WHERE ec.empresa_id = cr.entity_id
                LIMIT 1
              )
              WHEN cr.entity_type = 'grupo' THEN (
                SELECT gm.cliente_id
                FROM grupo_members gm
                WHERE gm.grupo_id = cr.entity_id AND gm.cliente_id IS NOT NULL
                LIMIT 1
              )
              ELSE cr.cliente_id
            END,
            cr.cliente_id
          )                AS cliente_id,
          COALESCE(
            CASE
              WHEN cr.entity_type = 'cliente' THEN cl_entity.name
              WHEN cr.entity_type = 'empresa' THEN CONCAT(e.name, ' (Empresa)')
              WHEN cr.entity_type = 'grupo'   THEN CONCAT(g.name, ' (Grupo)')
              ELSE cl_legacy.name
            END,
            cl_legacy.name
          )                AS cliente_nome,
          cr.entity_type,
          cr.entity_id
        FROM titulos_receber tr
        INNER JOIN contas_receber cr           ON tr.conta_receber_id = cr.id
        LEFT  JOIN clientes cl_legacy          ON cr.cliente_id = cl_legacy.id
        LEFT  JOIN clientes cl_entity          ON cr.entity_type = 'cliente' AND cr.entity_id = cl_entity.id
        LEFT  JOIN empresas e                  ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
        LEFT  JOIN grupos g                    ON cr.entity_type = 'grupo'   AND cr.entity_id = g.id
        LEFT  JOIN (
          SELECT DISTINCT conta_receber_id, projeto_id FROM contas_receber_projetos
          UNION
          SELECT DISTINCT conta_receber_id, projeto_id FROM contas_receber_faturamento
        ) all_projetos                         ON cr.id = all_projetos.conta_receber_id
        LEFT  JOIN projetos p                  ON all_projetos.projeto_id = p.id
        LEFT  JOIN contas_receber_projetos crp_direct ON cr.id = crp_direct.conta_receber_id AND all_projetos.projeto_id = crp_direct.projeto_id
        LEFT  JOIN contas c                    ON tr.conta_id = c.id
        WHERE
          ({{params.clienteId}} IS NULL OR (
            (cr.entity_type = 'cliente' AND cr.entity_id = {{params.clienteId}}) OR
            cr.cliente_id = {{params.clienteId}} OR
            (cr.entity_type = 'empresa' AND EXISTS (
              SELECT 1 FROM empresa_clientes ec
              WHERE ec.empresa_id = cr.entity_id AND ec.cliente_id = {{params.clienteId}}
            )) OR
            (cr.entity_type = 'grupo' AND EXISTS (
              SELECT 1 FROM grupo_members gm
              WHERE gm.grupo_id = cr.entity_id AND gm.cliente_id = {{params.clienteId}}
            ))
          ))
          AND ({{params.projetoId}} IS NULL OR p.id = {{params.projetoId}})
          AND ({{params.contaId}} IS NULL OR tr.conta_id = {{params.contaId}})
          AND ({{params.situacaoPagamento}} IS NULL OR
               ({{params.situacaoPagamento}} = 'quitado'  AND tr.status = 'RECEBIDO') OR
               ({{params.situacaoPagamento}} = 'pendente' AND tr.status != 'RECEBIDO'))
          {{ params.dataVencimentoInicio ? "AND tr.data_vencimento >= '" + params.dataVencimentoInicio + "'::date" : "" }}
          {{ params.dataVencimentoFim   ? "AND tr.data_vencimento <= '" + params.dataVencimentoFim   + "'::date" : "" }}
          {{ params.dataPagamentoInicio ? "AND tr.data_recebimento >= '" + params.dataPagamentoInicio + "'::date" : "" }}
          {{ params.dataPagamentoFim   ? "AND tr.data_recebimento <= '" + params.dataPagamentoFim   + "'::date" : "" }}
        -- DISTINCT ON requer ORDER iniciando pela coluna de dedup
        ORDER BY tr.id, p.name NULLS LAST
      )
      SELECT *
      FROM dedup
      ORDER BY data_vencimento DESC NULLS LAST, cliente_nome NULLS LAST;
    `,
  });
}

export default loadRelatorioClienteReceitas;
