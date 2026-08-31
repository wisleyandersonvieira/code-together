import { action } from '@uibakery/data';

/**
 * Atualiza um custo adicional. Ver `createModelagemCusto` para categoria,
 * grupo_pai, base_calculo, grupo_referencia/percentual e gatilho.
 *
 * `valor` continua sendo gravado mesmo quando a base é derivada: é o último total
 * que o usuário digitou, e apagá-lo ao trocar de base destruiria input dele. O
 * motor simplesmente não o lê enquanto base_calculo <> 'total'.
 */
function updateModelagemCusto() {
  return action('updateModelagemCusto', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_custos SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        label = '{{params.label}}',
        valor = COALESCE({{params.valor}}::decimal, 0),
        distribuicao = '{{params.distribuicao}}',
        mes_ancora = {{params.mesAncora}}::int,
        categoria = COALESCE(NULLIF('{{params.categoria}}', ''), 'outros'),
        -- NULLIF em torno do próprio id: uma linha não pode ser pai de si mesma,
        -- e o ciclo de tamanho 1 é o único que a interface consegue produzir.
        grupo_pai = NULLIF({{params.grupoPaiId}}::int, {{params.id}}::int),
        base_calculo = COALESCE(NULLIF('{{params.baseCalculo}}', ''), 'total'),
        valor_unitario = COALESCE({{params.valorUnitario}}::decimal, 0),
        grupo_referencia = NULLIF(NULLIF('{{params.grupoReferencia}}', ''), 'null'),
        percentual = COALESCE({{params.percentual}}::decimal, 0),
        gatilho = COALESCE(NULLIF('{{params.gatilho}}', ''), 'cronograma')
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemCusto;
