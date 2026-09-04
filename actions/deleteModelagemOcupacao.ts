import { action } from '@uibakery/data';

/** Remove um ponto da curva de ocupação. Sem ponto, o mês vale ZERO. */
function deleteModelagemOcupacao() {
  return action('deleteModelagemOcupacao', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_ocupacao
      WHERE modelagem_id = {{params.modelagemId}}::int
        AND mes = {{params.mes}}::int
    `,
  });
}

export default deleteModelagemOcupacao;
