import { action } from '@uibakery/data';

/**
 * Um ponto da curva do benchmark. Upsert pelo par (financiamento, mês), que é a
 * chave natural — o ponto não tem identidade própria na tela.
 *
 * Mês SEM linha não é benchmark zero: cai em `benchmark_padrao`. Por isso apagar
 * um ponto é diferente de gravá-lo com valor 0, e existe uma action separada para
 * remover.
 */
function saveModelagemBenchmarkPonto() {
  return action('saveModelagemBenchmarkPonto', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_benchmark_curva (modelagem_id, financiamento_id, mes, valor)
      SELECT {{params.modelagemId}}::int, f.id,
             GREATEST(1, COALESCE({{params.mes}}::int, 1)),
             COALESCE({{params.valor}}::decimal, 0)
      FROM modelagem_financiamento f
      WHERE f.modelagem_id = {{params.modelagemId}}::int
      ON CONFLICT (financiamento_id, mes)
      DO UPDATE SET valor = EXCLUDED.valor
    `,
  });
}

export default saveModelagemBenchmarkPonto;
