import { action } from '@uibakery/data';

/**
 * Cria a modelagem já com o cenário base, a linha de financiamento e a de
 * receita. Um único statement encadeado por CTE: não pode existir modelagem sem
 * cenário base (é ele que ancora os overrides) nem sem as linhas 1:1.
 */
function createModelagem() {
  return action('createModelagem', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH nova AS (
        INSERT INTO modelagens (
          empresa_id, projeto_id, nome, localizacao, tipo_uso, moeda, data_inicio,
          meses_aprovacao, meses_construcao, meses_pos_obra, horizonte_maximo,
          data_base, revisao, status
        ) VALUES (
          {{params.empresaId}}::int,
          {{params.projetoId}}::int,
          '{{params.nome}}',
          '{{params.localizacao}}',
          '{{params.tipoUso}}',
          COALESCE('{{params.moeda}}', 'USD'),
          '{{params.dataInicio}}'::date,
          COALESCE({{params.mesesAprovacao}}::int, 0),
          COALESCE({{params.mesesConstrucao}}::int, 0),
          COALESCE({{params.mesesPosObra}}::int, 0),
          COALESCE({{params.horizonteMaximo}}::int, 60),
          {{params.dataBase}}::date,
          '{{params.revisao}}',
          COALESCE('{{params.status}}', 'rascunho')
        ) RETURNING id
      ),
      cenario AS (
        INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline)
        SELECT id, 'Base', TRUE FROM nova
      ),
      fin AS (
        INSERT INTO modelagem_financiamento (modelagem_id, mes_inicio_saque, mes_fim_saque)
        SELECT id, 1, GREATEST(
          COALESCE({{params.mesesAprovacao}}::int, 0)
          + COALESCE({{params.mesesConstrucao}}::int, 0)
          + COALESCE({{params.mesesPosObra}}::int, 0), 1)
        FROM nova
      ),
      rec AS (
        INSERT INTO modelagem_receita (modelagem_id) SELECT id FROM nova
      )
      SELECT id FROM nova
    `,
  });
}

export default createModelagem;
