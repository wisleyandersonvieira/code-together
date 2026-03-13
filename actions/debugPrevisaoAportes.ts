import { action } from '@uibakery/data';

function debugPrevisaoAportes() {
  return action('debugPrevisaoAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      -- Debug: verificar estrutura das tabelas
      SELECT 
        'PROJETO_MEMBERS' as tabela,
        pm.id,
        pm.projeto_id,
        pm.cliente_id,
        pm.empresa_id,
        pm.grupo_id,
        pm.percentage
      FROM projeto_members pm
      WHERE pm.projeto_id = {{params.projetoId}}
      
      UNION ALL
      
      SELECT 
        'PREVISAO_APORTES' as tabela,
        pa.id,
        pa.projeto_id,
        pa.membro_id,
        NULL as empresa_id,
        NULL as grupo_id,
        pa.valor_previsto
      FROM previsao_aportes pa
      WHERE pa.projeto_id = {{params.projetoId}}
      
      ORDER BY tabela, id;
    `,
  });
}

export default debugPrevisaoAportes;
