import { action } from '@uibakery/data';

/**
 * Apaga a modelagem — exceto a MODELO.
 *
 * A guarda é `AND is_modelo = FALSE` no próprio DELETE, e não um `if` na tela:
 * este action é alcançável por qualquer caminho que o importe, e uma proteção
 * que só existe no botão não protege nada. Aqui, um DELETE do modelo
 * simplesmente não casa linha nenhuma.
 *
 * Por isso o RETURNING: sem ele o action devolveria sucesso vazio nos dois
 * casos — apagou e não apagou —, e a tela não teria como saber a diferença.
 * Lista vazia = era o modelo, e a interface diz isso ao usuário.
 *
 * O CASCADE das tabelas filhas continua fazendo o resto: quem é apagável leva
 * junto unidades, custos, cenários e overrides.
 */
function deleteModelagem() {
  return action('deleteModelagem', 'SQL', {
    databaseName: 'provision',
    query: `
      DELETE FROM modelagens
       WHERE id = {{params.id}}::int
         AND is_modelo = FALSE
      RETURNING id
    `,
  });
}

export default deleteModelagem;
