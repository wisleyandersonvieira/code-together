import { action } from '@uibakery/data';

function loadPrevisaoAportesRateio() {
  return action('loadPrevisaoAportesRateio', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        pa.id as aporte_id,
        pa.projeto_id,
        pa.membro_id,
        pa.data_previsao,
        pa.valor_previsto,
        pa.observacoes as aporte_observacoes,
        pm.percentage as membro_percentage,
        COALESCE(c.name, e.name, g.name) as membro_nome,
        CASE 
          WHEN pm.cliente_id IS NOT NULL THEN 'cliente'
          WHEN pm.empresa_id IS NOT NULL THEN 'empresa'
          ELSE 'grupo'
        END as membro_tipo,
        pm.cliente_id,
        pm.empresa_id,
        pm.grupo_id,
        -- Verificar se o cliente pode ratear para este membro
        CASE 
          -- Cliente direto: sempre pode
          WHEN pm.cliente_id = {{params.clienteId}} THEN true
          -- Empresa: verificar se cliente participa
          WHEN pm.empresa_id IS NOT NULL THEN EXISTS (
            SELECT 1 FROM empresa_clientes ec 
            WHERE ec.empresa_id = pm.empresa_id 
            AND ec.cliente_id = {{params.clienteId}}
          )
          -- Grupo: verificar se cliente participa diretamente ou via empresa
          WHEN pm.grupo_id IS NOT NULL THEN EXISTS (
            SELECT 1 FROM grupo_members gm 
            WHERE gm.grupo_id = pm.grupo_id 
            AND (
              gm.cliente_id = {{params.clienteId}}
              OR (
                gm.empresa_id IS NOT NULL 
                AND EXISTS (
                  SELECT 1 FROM empresa_clientes ec 
                  WHERE ec.empresa_id = gm.empresa_id 
                  AND ec.cliente_id = {{params.clienteId}}
                )
              )
            )
          )
          ELSE false
        END as pode_ratear,
        0 as valor_rateado -- Valor inicial para rateio
      FROM previsao_aportes pa
      INNER JOIN projeto_members pm ON pa.membro_id = pm.id
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      WHERE pa.projeto_id = {{params.projetoId}}
      ORDER BY pa.data_previsao, membro_nome;
    `,
  });
}

export default loadPrevisaoAportesRateio;
