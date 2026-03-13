import { action } from '@uibakery/data';

function loadRelatorioSaidas() {
  return action('loadRelatorioSaidas', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH filtered_items AS (
        SELECT
          tp.id as titulo_id,
          cp.id as conta_pagar_id,
          cp.numero_documento,
          f.name as fornecedor_nome,
          m.nome as matriz_nome,
          tp.data_pagamento,
          tp.status,
          tp.data_vencimento,
          cp.data_competencia,
          c.nome as conta_nome,
          c.banco as conta_banco,
          gc.descricao as grupo_contabil,
          sc.descricao as subgrupo_contabil,
          tp.conta_id,
          cp.observacoes,
          cpi.valor_total as item_valor,
          cpi.id as item_id,
          tp.valor_pago,
          tp.valor as valor_titulo
        FROM titulos_pagar tp
        JOIN contas_pagar cp ON tp.conta_pagar_id = cp.id
        JOIN fornecedores f ON cp.fornecedor_id = f.id
        LEFT JOIN matrizes m ON cp.matriz_id = m.id
        LEFT JOIN contas c ON tp.conta_id = c.id
        LEFT JOIN contas_pagar_itens cpi ON cp.id = cpi.conta_pagar_id
        LEFT JOIN produtos pr ON cpi.produto_id = pr.id
        LEFT JOIN subgrupos_contabeis sc ON pr.subgrupo_id = sc.id
        LEFT JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
        WHERE 1 = 1
          {{ params.matrizId ? "AND cp.matriz_id = " + params.matrizId : "" }}
          {{ params.status === 'PAGO' ? "AND tp.status = 'PAGO'" : params.status === 'PENDENTE' ? "AND tp.status = 'PENDENTE'" : "" }}
          {{ params.contaId ? "AND tp.conta_id = " + params.contaId : "" }}
          {{ params.fornecedorId ? "AND cp.fornecedor_id = " + params.fornecedorId : "" }}
          {{ params.dataCompetenciaInicio ? "AND cp.data_competencia >= '" + params.dataCompetenciaInicio + "'::date" : "" }}
          {{ params.dataCompetenciaFim ? "AND cp.data_competencia <= '" + params.dataCompetenciaFim + "'::date" : "" }}
          {{ params.dataPagamentoInicio ? "AND tp.data_pagamento >= '" + params.dataPagamentoInicio + "'::date" : "" }}
          {{ params.dataPagamentoFim ? "AND tp.data_pagamento <= '" + params.dataPagamentoFim + "'::date" : "" }}
          {{ params.grupoContabilId ? "AND gc.id = " + params.grupoContabilId : "" }}
          {{ params.subgrupoContabilId ? "AND sc.id = " + params.subgrupoContabilId : "" }}
      )
      SELECT
        fi.titulo_id as id,
        fi.numero_documento,
        fi.fornecedor_nome,
        fi.matriz_nome,
        STRING_AGG(DISTINCT p.name, ', ') as projeto_nomes,
        CASE 
          WHEN fi.status = 'PENDENTE' THEN MAX(fi.valor_titulo)
          WHEN {{ params.grupoContabilId ? "TRUE" : "FALSE" }} 
            OR {{ params.subgrupoContabilId ? "TRUE" : "FALSE" }}
          THEN COALESCE(SUM(DISTINCT fi.item_valor * fi.valor_pago / NULLIF(cp.valor_total, 0)), 0)
          ELSE MAX(fi.valor_pago)
        END as valor,
        fi.data_pagamento,
        fi.status,
        fi.data_vencimento,
        fi.data_competencia,
        fi.conta_nome,
        fi.conta_banco,
        fi.grupo_contabil,
        fi.subgrupo_contabil,
        fi.conta_id,
        fi.observacoes
      FROM filtered_items fi
      JOIN contas_pagar cp ON fi.conta_pagar_id = cp.id
      LEFT JOIN contas_pagar_projetos cpp ON cp.id = cpp.conta_pagar_id
      LEFT JOIN projetos p ON cpp.projeto_id = p.id
      WHERE 1 = 1
        {{ params.projetoIds ? "AND cpp.projeto_id = ANY(ARRAY[" + params.projetoIds.join(',') + "])" : "" }}
      GROUP BY 
        fi.titulo_id, fi.numero_documento, fi.fornecedor_nome, fi.matriz_nome,
        fi.data_pagamento, fi.status, fi.data_vencimento, fi.data_competencia,
        fi.conta_nome, fi.conta_banco, fi.grupo_contabil, fi.subgrupo_contabil, 
        fi.conta_id, fi.observacoes, fi.valor_pago, fi.valor_titulo, cp.valor_total
      ORDER BY 
        CASE 
          WHEN fi.data_pagamento IS NOT NULL THEN fi.data_pagamento 
          ELSE fi.data_vencimento 
        END DESC,
        fi.titulo_id DESC;
    `,
  });
}

export default loadRelatorioSaidas;
