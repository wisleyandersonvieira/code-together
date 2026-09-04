import { action } from '@uibakery/data';

/** Atualiza uma linha de OPEX. O valor é por pé quadrado de ABL e por ano. */
function updateModelagemOpex() {
  return action('updateModelagemOpex', 'SQL', {
    databaseName: 'provision',
    query: `
      UPDATE modelagem_opex SET
        ordem = COALESCE({{params.ordem}}::int, ordem),
        label = '{{params.label}}',
        valor_sf_ano = COALESCE({{params.valorSfAno}}::decimal, 0),
        reembolsavel = COALESCE({{params.reembolsavel}}::boolean, TRUE)
      WHERE id = {{params.id}}::int
    `,
  });
}

export default updateModelagemOpex;
