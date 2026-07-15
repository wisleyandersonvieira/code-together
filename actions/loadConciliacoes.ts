import { action } from '@uibakery/data';

// Carrega o estado de conciliação de uma conta. Usado no client para fazer o
// merge com as linhas do extrato (casando por origem + origem_id) e assim saber
// quais lançamentos já estão conciliados ao gerar/regenerar o extrato.
function loadConciliacoes() {
  return action('loadConciliacoes', 'SQL', {
    databaseName: 'provision',
    query: `
      SELECT
        origem,
        origem_id,
        conciliado
      FROM conciliacoes_extrato
      WHERE conta_id = {{params.contaId}}::int
        AND conciliado = true;
    `,
  });
}

export default loadConciliacoes;
