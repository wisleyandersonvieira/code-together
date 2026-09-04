import { action } from '@uibakery/data';

/**
 * Remove uma facilidade de crédito.
 *
 * Os OVERRIDES dela (`draw:N`, `amortization:N`) NÃO são apagados — nunca se
 * apaga input do usuário em silêncio neste módulo. Eles ficam guardados e
 * inativos, a conferência `overrides_facilidade_removida` acende âmbar, e voltam
 * a valer se uma facilidade for recriada na mesma posição da lista.
 *
 * `refinancia_facilidade_id` de quem apontava para esta cai para NULL sozinho:
 * a FK é ON DELETE SET NULL (migration 1764200000). O refinanciamento
 * simplesmente deixa de acontecer, em vez de apontar para uma linha que não
 * existe.
 */
function deleteModelagemFacilidade() {
  return action('deleteModelagemFacilidade', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_financiamento WHERE id = {{params.id}}::int`,
  });
}

export default deleteModelagemFacilidade;
