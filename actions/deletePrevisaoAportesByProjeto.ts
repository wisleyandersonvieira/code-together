import { action } from '@uibakery/data';

function deletePrevisaoAportesByProjeto() {
  return action('deletePrevisaoAportesByProjeto', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM previsao_aportes 
      WHERE projeto_id = {{params.projetoId}};
    `,
  });
}

export default deletePrevisaoAportesByProjeto;
