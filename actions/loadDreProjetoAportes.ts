import { action } from '@uibakery/data';

function loadDreProjetoAportes() {
  return action('loadDreProjetoAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        ra.id,
        ra.valor_rateado
      FROM rateio_aportes ra
      INNER JOIN contas_receber cr ON ra.conta_receber_id = cr.id
      INNER JOIN contas_receber_projetos crp ON cr.id = crp.conta_receber_id
      INNER JOIN projetos p ON crp.projeto_id = p.id
      WHERE cr.matriz_id = {{params.matrizId}}
        AND (
          {{params.statusProjeto}} = 'Ambos' OR 
          p.status = {{params.statusProjeto}}
        )
        AND cr.data_competencia BETWEEN {{params.dataInicio}} AND {{params.dataFim}}
      ORDER BY ra.id;
    `,
  });
}

export default loadDreProjetoAportes;
