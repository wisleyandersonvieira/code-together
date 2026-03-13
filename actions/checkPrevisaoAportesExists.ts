import { action } from '@uibakery/data';

function checkPrevisaoAportesExists() {
  return action('checkPrevisaoAportesExists', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        COUNT(*) as total_aportes,
        COUNT(DISTINCT pa.membro_id) as membros_com_aportes,
        (SELECT COUNT(*) FROM projeto_members WHERE projeto_id = {{params.projetoId}}) as total_membros_projeto
      FROM previsao_aportes pa
      WHERE pa.projeto_id = {{params.projetoId}};
    `,
  });
}

export default checkPrevisaoAportesExists;
