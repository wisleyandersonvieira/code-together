import { action } from '@uibakery/data';

/**
 * Cria uma fase. As datas são o input; o índice do mês é DERIVADO pelo motor a
 * partir de modelagens.data_inicio e nunca gravado — gravar índice faria a fase
 * se deslocar sozinha toda vez que o início do projeto mudasse.
 */
function createModelagemFase() {
  return action('createModelagemFase', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_fases (modelagem_id, ordem, nome, data_inicio, data_fim)
      VALUES (
        {{params.modelagemId}}::int,
        COALESCE({{params.ordem}}::int, 0),
        '{{params.nome}}',
        '{{params.dataInicio}}'::date,
        '{{params.dataFim}}'::date
      ) RETURNING id
    `,
  });
}

export default createModelagemFase;
