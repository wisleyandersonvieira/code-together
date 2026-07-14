import { action } from '@uibakery/data';

function loadEmprestimos() {
  return action('loadEmprestimos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        e.*,
        s.nome as socio_nome,
        m.nome as matriz_nome,
        c.nome as conta_nome
      FROM emprestimos e
      JOIN socios s ON e.socio_id = s.id
      JOIN matrizes m ON e.matriz_id = m.id
      JOIN contas c ON e.conta_id = c.id
      WHERE 1 = 1
        {{ params && params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'" : "" }}
        {{ params && params.dataFim ? "AND e.data_emprestimo <= '" + params.dataFim + "'" : "" }}
        {{ params && params.matrizId ? "AND e.matriz_id = " + params.matrizId : "" }}
        {{ params && params.socioId ? "AND e.socio_id = " + params.socioId : "" }}
        {{ params && params.contaId ? "AND e.conta_id = " + params.contaId : "" }}
        {{ params && params.tipo ? "AND e.tipo = '" + params.tipo + "'" : "" }}
      ORDER BY e.data_emprestimo DESC, e.created_at DESC
      {{ params && !params.exportAll && params.hasFilters ? "LIMIT 10" : "" }}
      {{ params && !params.exportAll && params.hasFilters && params.page ? "OFFSET " + ((params.page - 1) * 10) : "" }}
      {{ !params || (!params.exportAll && !params.hasFilters) ? "LIMIT 5" : "" }};
    `,
  });
}

export default loadEmprestimos;
