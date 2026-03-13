import { action } from '@uibakery/data';

function checkProjetoStatusForAlocacao() {
  return action('checkProjetoStatusForAlocacao', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        id,
        name,
        status,
        CASE 
          WHEN status = 'Concluído' THEN false
          ELSE true
        END as pode_alterar_alocacao
      FROM projetos 
      WHERE id = {{params.projetoId}};
    `,
  });
}

export default checkProjetoStatusForAlocacao;
