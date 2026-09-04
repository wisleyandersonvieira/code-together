import { action } from '@uibakery/data';

/** Cria uma linha do plano de contas da OPERAÇÃO (migration 1764100000). */
function createModelagemOpex() {
  return action('createModelagemOpex', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_opex (modelagem_id, ordem, label, valor_sf_ano, reembolsavel)
      VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.label}}',
        COALESCE({{params.valorSfAno}}::decimal, 0),
        -- DEFAULT TRUE da coluna: property taxes, seguro e manutenção entram na
        -- base do reembolso NNN. A exceção — reserva de CapEx — o usuário
        -- desmarca, e é despesa do proprietário, não do ocupante.
        COALESCE({{params.reembolsavel}}::boolean, TRUE)
      ) RETURNING id
    `,
  });
}

export default createModelagemOpex;
