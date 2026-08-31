import { action } from '@uibakery/data';

/** Remove um ponto da curva. Apagar ≠ gravar zero: sem ponto, vale o padrão. */
function deleteModelagemBenchmarkPonto() {
  return action('deleteModelagemBenchmarkPonto', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_benchmark_curva
      WHERE modelagem_id = {{params.modelagemId}}::int
        AND mes = {{params.mes}}::int
    `,
  });
}

export default deleteModelagemBenchmarkPonto;
