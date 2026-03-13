import { action } from '@uibakery/data';

function loadExtratoCliente() {
  return action('loadExtratoCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        tr.data_recebimento::text as data_pagamento,
        p.name as projeto_nome,
        tr.valor_recebido as valor,
        c.nome as conta_corrente,
        tr.observacoes_recebimento as observacoes,
        cr.numero_documento,
        COALESCE(
          CASE 
            WHEN cr.entity_type = 'cliente' THEN cl_entity.name
            WHEN cr.entity_type = 'empresa' THEN e.name
            WHEN cr.entity_type = 'grupo' THEN g.name
            ELSE cl_legacy.name
          END,
          cl_legacy.name
        ) as cliente_nome
      FROM titulos_receber tr
      INNER JOIN contas_receber cr ON cr.id = tr.conta_receber_id
      -- Legacy cliente relationship
      LEFT JOIN clientes cl_legacy ON cr.cliente_id = cl_legacy.id
      -- New entity relationships  
      LEFT JOIN clientes cl_entity ON cr.entity_type = 'cliente' AND cr.entity_id = cl_entity.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
      LEFT JOIN contas_receber_projetos crp ON crp.conta_receber_id = cr.id
      LEFT JOIN projetos p ON p.id = crp.projeto_id
      LEFT JOIN contas c ON c.id = tr.conta_id
      WHERE 
        tr.status = 'RECEBIDO'
        AND tr.data_recebimento IS NOT NULL
        AND tr.valor_recebido > 0
        AND (
          '{{params.entityType}}' IS NULL OR 
          (
            '{{params.entityType}}' = 'cliente' AND 
            (
              cr.cliente_id = {{params.entityId}} OR 
              (cr.entity_type = 'cliente' AND cr.entity_id = {{params.entityId}})
            )
          ) OR
          ('{{params.entityType}}' = 'empresa' AND cr.entity_type = 'empresa' AND cr.entity_id = {{params.entityId}}) OR
          ('{{params.entityType}}' = 'grupo' AND cr.entity_type = 'grupo' AND cr.entity_id = {{params.entityId}})
        )
        AND ({{params.projetoIds}} IS NULL OR crp.projeto_id = {{params.projetoIds}})
        AND ({{params.contaId}} IS NULL OR tr.conta_id = {{params.contaId}})
        AND ('{{params.dataInicio}}' IS NULL OR tr.data_recebimento >= '{{params.dataInicio}}'::date)
        AND ('{{params.dataFim}}' IS NULL OR tr.data_recebimento <= '{{params.dataFim}}'::date)
      ORDER BY tr.data_recebimento DESC
    `,
  });
}

export default loadExtratoCliente;
