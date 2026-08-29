import { action } from '@uibakery/data';

function createModelagemSocio() {
  return action('createModelagemSocio', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_socios (modelagem_id, ordem, nome, participacao_pct, cota_disponivel, observacoes)
      VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.nome}}',
        COALESCE({{params.participacaoPct}}::decimal, 0),
        COALESCE({{params.cotaDisponivel}}::boolean, FALSE),
        '{{params.observacoes}}'
      ) RETURNING id
    `,
  });
}

export default createModelagemSocio;
