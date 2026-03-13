import { action } from '@uibakery/data';

function loadExtrato() {
  return action('loadExtrato', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH movimentacoes AS (
        -- Títulos a Pagar (Saídas) - com rateio por projeto
        SELECT 
          tp.data_pagamento::text as data,
          f.name as fornecedor_creditor,
          cp.numero_documento,
          p.name as projeto,
          -- Se tem rateio, usa valor_rateio (uma linha por projeto); senão usa valor_pago total
          -COALESCE(cpp.valor_rateio, tp.valor_pago)::numeric(15,2) as valor,
          'CP' as tipo,
          m.nome as matriz_nome,
          tp.data_pagamento as data_ordenacao,
          tp.created_at as created_at_ordenacao
        FROM titulos_pagar tp
        INNER JOIN contas_pagar cp ON tp.conta_pagar_id = cp.id
        LEFT JOIN fornecedores f ON cp.fornecedor_id = f.id
        LEFT JOIN matrizes m ON cp.matriz_id = m.id
        LEFT JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
        LEFT JOIN projetos p ON cpp.projeto_id = p.id
        WHERE tp.conta_id = {{params.contaId}}
          AND tp.status = 'PAGO'
          AND tp.data_pagamento IS NOT NULL
          {{ params.dataInicio ? "AND tp.data_pagamento >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim ? "AND tp.data_pagamento <= '" + params.dataFim + "'::date" : "" }}
          {{ params.tipo ? "AND 'CP' = '" + params.tipo + "'" : "" }}
          {{ params.matrizId ? "AND cp.matriz_id = " + params.matrizId : "" }}
        
        UNION ALL
        
        -- Títulos a Receber (Entradas) - com rateio/faturamento por projeto
        SELECT 
          tr.data_recebimento::text as data,
          COALESCE(
            CASE 
              WHEN cr.entity_type = 'cliente' THEN cl_entity.name
              WHEN cr.entity_type = 'empresa' THEN CONCAT(e.name, ' (Empresa)')
              WHEN cr.entity_type = 'grupo' THEN CONCAT(g.name, ' (Grupo)')
              ELSE cl_legacy.name
            END,
            cl_legacy.name
          ) as fornecedor_creditor,
          cr.numero_documento,
          COALESCE(p_rateio.name, p_faturamento.name) as projeto,
          -- Se tem rateio, usa valor_rateio; se tem faturamento, usa valor_faturamento; senão usa valor_recebido total
          COALESCE(crp.valor_rateio, crf.valor_faturamento, tr.valor_recebido)::numeric(15,2) as valor,
          'CR' as tipo,
          m.nome as matriz_nome,
          tr.data_recebimento as data_ordenacao,
          tr.created_at as created_at_ordenacao
        FROM titulos_receber tr
        INNER JOIN contas_receber cr ON tr.conta_receber_id = cr.id
        -- Legacy cliente relationship
        LEFT JOIN clientes cl_legacy ON cr.cliente_id = cl_legacy.id
        -- New entity relationships
        LEFT JOIN clientes cl_entity ON cr.entity_type = 'cliente' AND cr.entity_id = cl_entity.id
        LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
        LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
        LEFT JOIN matrizes m ON cr.matriz_id = m.id
        -- Rateio tradicional por projeto
        LEFT JOIN contas_receber_projetos crp ON cr.id = crp.conta_receber_id
        LEFT JOIN projetos p_rateio ON crp.projeto_id = p_rateio.id
        -- Faturamento por projeto (prioritário)
        LEFT JOIN contas_receber_faturamento crf ON cr.id = crf.conta_receber_id
        LEFT JOIN projetos p_faturamento ON crf.projeto_id = p_faturamento.id
        WHERE tr.conta_id = {{params.contaId}}
          AND tr.status = 'RECEBIDO'
          AND tr.data_recebimento IS NOT NULL
          {{ params.dataInicio ? "AND tr.data_recebimento >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim ? "AND tr.data_recebimento <= '" + params.dataFim + "'::date" : "" }}
          {{ params.tipo ? "AND 'CR' = '" + params.tipo + "'" : "" }}
          {{ params.matrizId ? "AND cr.matriz_id = " + params.matrizId : "" }}
        
        UNION ALL
        
        -- Transferências de Saída
        SELECT 
          t.data_transferencia::text as data,
          CONCAT('Transf: p/ ', cd.nome) as fornecedor_creditor,
          NULL as numero_documento,
          NULL as projeto,
          -t.valor::numeric(15,2) as valor,
          'TR' as tipo,
          NULL as matriz_nome,
          t.data_transferencia as data_ordenacao,
          t.created_at as created_at_ordenacao
        FROM transferencias t
        INNER JOIN contas cd ON t.conta_destino_id = cd.id
        WHERE t.conta_origem_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim ? "AND t.data_transferencia <= '" + params.dataFim + "'::date" : "" }}
          {{ params.tipo ? "AND 'TR' = '" + params.tipo + "'" : "" }}
        
        UNION ALL
        
        -- Transferências de Entrada
        SELECT 
          t.data_transferencia::text as data,
          CONCAT('Transf: de ', co.nome) as fornecedor_creditor,
          NULL as numero_documento,
          NULL as projeto,
          t.valor::numeric(15,2) as valor,
          'TR' as tipo,
          NULL as matriz_nome,
          t.data_transferencia as data_ordenacao,
          t.created_at as created_at_ordenacao
        FROM transferencias t
        INNER JOIN contas co ON t.conta_origem_id = co.id
        WHERE t.conta_destino_id = {{params.contaId}}
          AND t.data_transferencia IS NOT NULL
          {{ params.dataInicio ? "AND t.data_transferencia >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim ? "AND t.data_transferencia <= '" + params.dataFim + "'::date" : "" }}
          {{ params.tipo ? "AND 'TR' = '" + params.tipo + "'" : "" }}
        
        UNION ALL
        
        -- Aportes (Entradas - Crédito)
        SELECT 
          a.data_aporte::text as data,
          s.nome as fornecedor_creditor,
          NULL as numero_documento,
          NULL as projeto,
          a.valor::numeric(15,2) as valor,
          'APORTE' as tipo,
          m.nome as matriz_nome,
          a.data_aporte as data_ordenacao,
          a.created_at as created_at_ordenacao
        FROM aportes a
        INNER JOIN socios s ON a.socio_id = s.id
        LEFT JOIN matrizes m ON a.matriz_id = m.id
        WHERE a.conta_id = {{params.contaId}}
          AND a.data_aporte IS NOT NULL
          {{ params.dataInicio ? "AND a.data_aporte >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim ? "AND a.data_aporte <= '" + params.dataFim + "'::date" : "" }}
          {{ params.tipo ? "AND 'APORTE' = '" + params.tipo + "'" : "" }}
          {{ params.matrizId ? "AND a.matriz_id = " + params.matrizId : "" }}
        
        UNION ALL
        
        -- Retiradas (Saídas - Débito)
        SELECT 
          r.data_retirada::text as data,
          s.nome as fornecedor_creditor,
          NULL as numero_documento,
          NULL as projeto,
          -r.valor::numeric(15,2) as valor,
          'RETIRADA' as tipo,
          m.nome as matriz_nome,
          r.data_retirada as data_ordenacao,
          r.created_at as created_at_ordenacao
        FROM retiradas r
        INNER JOIN socios s ON r.socio_id = s.id
        LEFT JOIN matrizes m ON r.matriz_id = m.id
        WHERE r.conta_id = {{params.contaId}}
          AND r.data_retirada IS NOT NULL
          {{ params.dataInicio ? "AND r.data_retirada >= '" + params.dataInicio + "'::date" : "" }}
          {{ params.dataFim ? "AND r.data_retirada <= '" + params.dataFim + "'::date" : "" }}
          {{ params.tipo ? "AND 'RETIRADA' = '" + params.tipo + "'" : "" }}
          {{ params.matrizId ? "AND r.matriz_id = " + params.matrizId : "" }}
      )
      SELECT * FROM movimentacoes
      ORDER BY data_ordenacao ASC, created_at_ordenacao ASC;
    `,
  });
}

export default loadExtrato;
