import { action } from '@uibakery/data';

/**
 * Limpa TODAS as parcelas de um custo.
 *
 * Usada só quando o gerador substituiu o parcelamento inteiro — a lista nova não
 * tem id nenhum, então o diff por id viraria N DELETEs seguidos de M INSERTs.
 * Um DELETE só faz a mesma coisa numa ida ao banco, e a substituição fica
 * atômica para quem lê no meio do salvamento.
 *
 * Nunca chamada sem o usuário ter confirmado a substituição na aba Orçamento:
 * parcela do usuário não some em silêncio.
 */
function deleteModelagemCustoParcelasDoCusto() {
  return action('deleteModelagemCustoParcelasDoCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagem_custo_parcelas
      WHERE custo_id = {{params.custoId}}::int
    `,
  });
}

export default deleteModelagemCustoParcelasDoCusto;
