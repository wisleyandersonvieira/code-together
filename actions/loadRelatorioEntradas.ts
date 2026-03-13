import { action } from '@uibakery/data';

function loadRelatorioEntradas() {
  return action('loadRelatorioEntradas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        tr.id,
        cr.numero_documento,
        CASE 
          WHEN cr.entity_type = 'cliente' THEN cl.name
          WHEN cr.entity_type = 'empresa' THEN e.name
          WHEN cr.entity_type = 'grupo' THEN g.name
          ELSE 'N/A'
        END as cliente_nome,
        m.nome as matriz_nome,
        STRING_AGG(DISTINCT COALESCE(p.name, pf.name), ', ') as projeto_nomes,
        CASE 
          WHEN tr.status = 'PENDENTE' THEN tr.valor
          ELSE tr.valor_recebido
        END as valor,
        tr.data_recebimento,
        tr.status,
        tr.data_vencimento,
        cr.data_competencia,
        c.nome as conta_nome,
        c.banco as conta_banco,
        gc.descricao as grupo_contabil,
        sc.descricao as subgrupo_contabil,
        tr.conta_id,
        cr.observacoes
      FROM titulos_receber tr
      JOIN contas_receber cr ON tr.conta_receber_id = cr.id
      LEFT JOIN clientes cl ON cr.entity_type = 'cliente' AND cr.entity_id = cl.id
      LEFT JOIN empresas e ON cr.entity_type = 'empresa' AND cr.entity_id = e.id
      LEFT JOIN grupos g ON cr.entity_type = 'grupo' AND cr.entity_id = g.id
      LEFT JOIN matrizes m ON cr.matriz_id = m.id
      LEFT JOIN contas_receber_projetos crp ON cr.id = crp.conta_receber_id
      LEFT JOIN projetos p ON crp.projeto_id = p.id
      LEFT JOIN contas_receber_faturamento crf ON cr.id = crf.conta_receber_id
      LEFT JOIN projetos pf ON crf.projeto_id = pf.id
      LEFT JOIN contas c ON tr.conta_id = c.id
      LEFT JOIN contas_receber_itens cri ON cr.id = cri.conta_receber_id
      LEFT JOIN produtos pr ON cri.produto_id = pr.id
      LEFT JOIN subgrupos_contabeis sc ON pr.subgrupo_id = sc.id
      LEFT JOIN grupos_contabeis gc ON sc.grupo_id = gc.id
      WHERE 1 = 1
        {{ params.matrizId ? "AND cr.matriz_id = " + params.matrizId : "" }}
        {{ params.status === 'RECEBIDO' ? "AND tr.status = 'RECEBIDO'" : params.status === 'PENDENTE' ? "AND tr.status = 'PENDENTE'" : "" }}
        {{ params.contaId ? "AND tr.conta_id = " + params.contaId : "" }}
        {{ params.clienteId ? "AND ((cr.entity_type = 'cliente' AND cr.entity_id = " + params.clienteId + ") OR (cr.entity_type = 'empresa' AND cr.entity_id = " + params.clienteId + ") OR (cr.entity_type = 'grupo' AND cr.entity_id = " + params.clienteId + "))" : "" }}
        {{ params.dataCompetenciaInicio ? "AND cr.data_competencia >= '" + params.dataCompetenciaInicio + "'::date" : "" }}
        {{ params.dataCompetenciaFim ? "AND cr.data_competencia <= '" + params.dataCompetenciaFim + "'::date" : "" }}
        {{ params.dataRecebimentoInicio ? "AND tr.data_recebimento >= '" + params.dataRecebimentoInicio + "'::date" : "" }}
        {{ params.dataRecebimentoFim ? "AND tr.data_recebimento <= '" + params.dataRecebimentoFim + "'::date" : "" }}
        {{ params.grupoContabilId ? "AND gc.id = " + params.grupoContabilId : "" }}
        {{ params.subgrupoContabilId ? "AND sc.id = " + params.subgrupoContabilId : "" }}
        {{ params.projetoId ? "AND (crp.projeto_id = " + params.projetoId + " OR crf.projeto_id = " + params.projetoId + ")" : "" }}
      GROUP BY 
        tr.id, cr.numero_documento, cr.entity_type, cl.name, e.name, g.name, m.nome, tr.valor_recebido, tr.valor,
        tr.data_recebimento, tr.status, tr.data_vencimento, cr.data_competencia,
        c.nome, c.banco, gc.descricao, sc.descricao, tr.conta_id, cr.observacoes
      ORDER BY 
        CASE 
          WHEN tr.data_recebimento IS NOT NULL THEN tr.data_recebimento 
          ELSE tr.data_vencimento 
        END DESC,
        tr.id DESC;
    `,
  });
}

export default loadRelatorioEntradas;
