import { action } from '@uibakery/data';

function loadAportes() {
  return action('loadAportes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        a.*,
        s.nome as socio_nome,
        m.nome as matriz_nome,
        c.nome as conta_nome
      FROM aportes a
      JOIN socios s ON a.socio_id = s.id
      JOIN matrizes m ON a.matriz_id = m.id  
      JOIN contas c ON a.conta_id = c.id
      WHERE 1 = 1
        {{ params.dataInicio ? "AND a.data_aporte >= '" + params.dataInicio + "'" : "" }}
        {{ params.dataFim ? "AND a.data_aporte <= '" + params.dataFim + "'" : "" }}
        {{ params.matrizId ? "AND a.matriz_id = " + params.matrizId : "" }}
        {{ params.socioId ? "AND a.socio_id = " + params.socioId : "" }}
        {{ params.contaId ? "AND a.conta_id = " + params.contaId : "" }}
      ORDER BY a.data_aporte DESC, a.created_at DESC;
    `,
  });
}

export default loadAportes;

