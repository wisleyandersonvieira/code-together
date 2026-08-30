import { action } from '@uibakery/data';

/**
 * Limpa o plano inteiro. Usada só pelo gerador de parcelas, depois que o usuário
 * confirmou que quer substituir o que já existia — nunca em silêncio.
 */
function deleteModelagemAporteParcelasTodas() {
  return action('deleteModelagemAporteParcelasTodas', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_aporte_parcelas
      WHERE modelagem_id = {{params.modelagemId}}::int
    `,
  });
}

export default deleteModelagemAporteParcelasTodas;
