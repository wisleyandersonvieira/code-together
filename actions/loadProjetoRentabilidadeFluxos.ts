import { action } from '@uibakery/data';

function loadProjetoRentabilidadeFluxos() {
  return action('loadProjetoRentabilidadeFluxos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        ra.id AS fluxo_real_id,
        pa.projeto_id,
        p.name AS projeto_nome,
        pm.id AS membro_id,
        pm.percentage,
        COALESCE(c.name, e.name, g.name) AS membro_nome,
        CASE
          WHEN pm.cliente_id IS NOT NULL THEN 'cliente'
          WHEN pm.empresa_id IS NOT NULL THEN 'empresa'
          ELSE 'grupo'
        END AS membro_tipo,
        COALESCE(
          (
            SELECT MIN(tr.data_recebimento)
            FROM titulos_receber tr
            WHERE tr.conta_receber_id = cr.id
              AND tr.status = 'RECEBIDO'
              AND tr.data_recebimento IS NOT NULL
          ),
          cr.data_competencia,
          cr.data_vencimento,
          pa.data_previsao
        ) AS data_fluxo,
        pa.data_previsao,
        ra.valor_rateado AS valor,
        cr.id AS conta_receber_id,
        cr.numero_documento,
        COALESCE(cr.observacoes, pa.observacoes) AS observacoes
      FROM rateio_aportes ra
      INNER JOIN previsao_aportes pa ON pa.id = ra.aporte_id
      INNER JOIN projeto_members pm ON pm.id = pa.membro_id
      INNER JOIN projetos p ON p.id = pa.projeto_id
      INNER JOIN contas_receber cr ON cr.id = ra.conta_receber_id
      INNER JOIN contas_receber_projetos crp
        ON crp.conta_receber_id = cr.id
       AND crp.projeto_id = pa.projeto_id
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      WHERE pa.projeto_id = {{params.projetoId}}
        AND COALESCE(ra.valor_rateado, 0) > 0
      ORDER BY data_fluxo, membro_nome, ra.id;
    `,
  });
}

export default loadProjetoRentabilidadeFluxos;
