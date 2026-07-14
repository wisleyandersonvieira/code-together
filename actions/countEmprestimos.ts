import { action } from '@uibakery/data';

function countEmprestimos() {
  return action('countEmprestimos', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT COUNT(*) as total
      FROM emprestimos e
      WHERE {{ params && params.skipCount ? "FALSE" : "1 = 1" }}
        {{ params && params.dataInicio ? "AND e.data_emprestimo >= '" + params.dataInicio + "'" : "" }}
        {{ params && params.dataFim ? "AND e.data_emprestimo <= '" + params.dataFim + "'" : "" }}
        {{ params && params.matrizId ? "AND e.matriz_id = " + params.matrizId : "" }}
        {{ params && params.socioId ? "AND e.socio_id = " + params.socioId : "" }}
        {{ params && params.contaId ? "AND e.conta_id = " + params.contaId : "" }}
        {{ params && params.tipo ? "AND e.tipo = '" + params.tipo + "'" : "" }};
    `,
  });
}

export default countEmprestimos;
