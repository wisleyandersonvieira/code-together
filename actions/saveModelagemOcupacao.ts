import { action } from '@uibakery/data';

/**
 * Um ponto da curva de ocupação (migration 1764100000). Upsert pelo par
 * (modelagem, mês), que é a chave natural — o ponto não tem identidade na tela.
 *
 * Aqui o UNIQUE (modelagem_id, mes) e o `ON CONFLICT ... DO UPDATE` fazem
 * sentido, e é a exceção deliberada à regra do módulo: em parcelas, takedowns e
 * aportes o duplicado SOMA, porque somar é a leitura que não perde dinheiro do
 * usuário. Duas ocupações no mesmo mês não somam — 85% + 85% não é 170% —,
 * seriam contraditórias, e a última substituir a anterior é a única leitura
 * possível.
 *
 * Mês SEM linha é ocupação ZERO, não ocupação padrão. Por isso apagar um ponto e
 * gravá-lo com 0 dão o MESMO resultado no fluxo, ao contrário da curva do
 * benchmark — mas a distinção continua importando na tela: um zero declarado diz
 * "aqui é vazio de propósito", e a ausência diz "ainda não preenchi".
 */
function saveModelagemOcupacao() {
  return action('saveModelagemOcupacao', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_ocupacao (modelagem_id, mes, ocupacao_pct)
      VALUES (
        {{params.modelagemId}}::int,
        GREATEST(1, COALESCE({{params.mes}}::int, 1)),
        -- O CHECK da coluna exige 0..1. O clamp aqui evita que um valor digitado
        -- como percentual (85 em vez de 0,85) derrube a gravação inteira com
        -- erro de constraint — vira 1, e a tela mostra 100%.
        LEAST(1, GREATEST(0, COALESCE({{params.ocupacaoPct}}::decimal, 0)))
      )
      ON CONFLICT (modelagem_id, mes)
      DO UPDATE SET ocupacao_pct = EXCLUDED.ocupacao_pct
    `,
  });
}

export default saveModelagemOcupacao;
