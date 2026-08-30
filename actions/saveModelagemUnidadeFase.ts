import { action } from '@uibakery/data';

/**
 * Quantas unidades de uma tipologia caem numa fase.
 *
 * Upsert pela UNIQUE (unidade_id, fase_id): a matriz da aba Tipologias reescreve
 * a mesma célula quantas vezes o usuário quiser, e a linha do banco é uma só.
 * `modelagem_id` vai junto porque é o filtro de todas as consultas — a chave
 * natural continua sendo o par unidade × fase.
 */
function saveModelagemUnidadeFase() {
  return action('saveModelagemUnidadeFase', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_unidade_fases (modelagem_id, unidade_id, fase_id, quantidade)
      VALUES (
        {{params.modelagemId}}::int,
        {{params.unidadeId}}::int,
        {{params.faseId}}::int,
        GREATEST(0, COALESCE({{params.quantidade}}::int, 0))
      )
      ON CONFLICT (unidade_id, fase_id)
      DO UPDATE SET quantidade = EXCLUDED.quantidade
      RETURNING id
    `,
  });
}

export default saveModelagemUnidadeFase;
