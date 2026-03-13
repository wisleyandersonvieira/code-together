import { action } from '@uibakery/data';

function verificarParticipacaoCliente() {
  return action('verificarParticipacaoCliente', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Verificar quais membros do projeto o cliente pode ratear
      SELECT 
        pm.id as membro_id,
        COALESCE(c.name, e.name, g.name) as membro_nome,
        pm.percentage as membro_percentage,
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
        END as pode_ratear
      FROM projeto_members pm
      LEFT JOIN clientes c ON pm.cliente_id = c.id
      LEFT JOIN empresas e ON pm.empresa_id = e.id
      LEFT JOIN grupos g ON pm.grupo_id = g.id
      WHERE pm.projeto_id = {{params.projetoId}}
      ORDER BY membro_nome;
    `,
  });
}

export default verificarParticipacaoCliente;
