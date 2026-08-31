import { action } from '@uibakery/data';

/**
 * Atualiza um sócio.
 *
 * `pct_capital` preserva o NULL: nulo é "usa participacao_pct" (o comportamento
 * anterior à migration 1763100000) e ZERO é "não põe capital nenhum". O NULLIF
 * duplo é o mesmo truque de `createModelagemCusto`: um null interpolado dentro de
 * aspas chegaria aqui como o TEXTO 'null', que viraria zero na coerção e apagaria
 * a distinção em silêncio.
 */
function updateModelagemSocio() {
  return action('updateModelagemSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_socios SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        nome = '{{params.nome}}',
        participacao_pct = COALESCE({{params.participacaoPct}}::decimal, 0),
        cota_disponivel = COALESCE({{params.cotaDisponivel}}::boolean, FALSE),
        pct_capital = NULLIF(NULLIF('{{params.pctCapital}}', ''), 'null')::decimal,
        observacoes = '{{params.observacoes}}'
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemSocio;
