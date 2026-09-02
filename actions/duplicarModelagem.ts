import { action } from '@uibakery/data';

/**
 * Duplica uma modelagem inteira e devolve o id da cópia.
 *
 * Um statement só, porque o trabalho todo mora na função `duplicar_modelagem`
 * (migration 1763700000): são 17 tabelas com FKs internas, e copiá-las daqui,
 * uma chamada por vez, deixaria modelagem pela metade se qualquer uma falhasse.
 * A função é atômica — ou a cópia inteira nasce, ou nada nasce.
 *
 * Serve para QUALQUER modelagem, inclusive a modelo: é assim que o usuário
 * transforma o plano de contas numa modelagem de verdade. A cópia sempre nasce
 * com `is_modelo = FALSE` e `status = 'rascunho'`.
 */
function duplicarModelagem() {
  return action('duplicarModelagem', 'SQL', {
    databaseName: 'provision',
    query: `SELECT duplicar_modelagem({{params.origemId}}::int, '{{params.nome}}') AS id`,
  });
}

export default duplicarModelagem;
