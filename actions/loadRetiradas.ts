import { action } from '@uibakery/data';
import { andIdIn, andIdInWhenPagamento } from '@/lib/sql-filters';

function loadRetiradas() {
  return action('loadRetiradas', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT 
        r.*,
        s.nome as socio_nome,
        m.nome as matriz_nome,
        c.nome as conta_nome
      FROM retiradas r
      JOIN socios s ON r.socio_id = s.id
      JOIN matrizes m ON r.matriz_id = m.id  
      JOIN contas c ON r.conta_id = c.id
      WHERE 1 = 1
        {{ params.dataInicio ? "AND r.data_retirada >= '" + params.dataInicio + "'" : "" }}
        {{ params.dataFim ? "AND r.data_retirada <= '" + params.dataFim + "'" : "" }}
        {{ params.matrizId ? "AND r.matriz_id = " + params.matrizId : "" }}
        {{ params.socioId ? "AND r.socio_id = " + params.socioId : "" }}
        {{ params.contaId ? "AND r.conta_id = " + params.contaId : "" }}
        ${andIdIn('r.matriz_id', 'matrizIds')}
        ${andIdInWhenPagamento('r.conta_id', 'contaIds')}
      ORDER BY r.data_retirada DESC, r.created_at DESC;
    `,
  });
}

export default loadRetiradas;


