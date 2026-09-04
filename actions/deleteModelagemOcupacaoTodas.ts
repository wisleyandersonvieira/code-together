import { action } from '@uibakery/data';

/**
 * Limpa a curva de ocupação inteira.
 *
 * Existe para o GERADOR de rampa da aba Operação: gerar uma curva nova sobre uma
 * existente deixaria os meses antigos que a nova não cobre pendurados, e a curva
 * resultante seria a mistura de duas — sem nada na tela dizendo isso. A tela
 * pede CONFIRMAÇÃO antes de chamar esta ação, porque ela apaga input do usuário;
 * é a única no módulo que faz isso, e só sob confirmação explícita.
 */
function deleteModelagemOcupacaoTodas() {
  return action('deleteModelagemOcupacaoTodas', 'SQL', {
    databaseName: 'provision',
    query: `DELETE FROM modelagem_ocupacao WHERE modelagem_id = {{params.modelagemId}}::int`,
  });
}

export default deleteModelagemOcupacaoTodas;
