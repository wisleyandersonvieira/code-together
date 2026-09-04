import { action } from '@uibakery/data';

/**
 * Remove um ponto da curva. Apagar ≠ gravar zero: sem ponto, vale o padrão.
 *
 * `financiamentoId` entrou com a migration 1764200000, pela mesma razão do save:
 * cada facilidade tem a própria curva, e apagar sem qualificar removeria o ponto
 * das outras.
 */
function deleteModelagemBenchmarkPonto() {
  return action('deleteModelagemBenchmarkPonto', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_benchmark_curva
      WHERE modelagem_id = {{params.modelagemId}}::int
        AND financiamento_id = {{params.financiamentoId}}::int
        AND mes = {{params.mes}}::int
    `,
  });
}

export default deleteModelagemBenchmarkPonto;
