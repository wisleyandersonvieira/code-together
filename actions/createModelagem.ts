import { action } from '@uibakery/data';

/**
 * Cria a modelagem já com o cenário base, a primeira facilidade de crédito e a
 * linha de receita. Um único statement encadeado por CTE: não pode existir
 * modelagem sem cenário base (é ele que ancora os overrides) nem sem as linhas
 * 1:1.
 *
 * ─── O tipo, e por que ele entra AQUI e em nenhum outro lugar ───────────────
 * `tipo_modelagem` é escolhido na criação e não muda depois (migration
 * 1764000000): cada modo tem campos que o outro ignora, e trocar deixaria campos
 * órfãos de um modo dentro do outro. O default 'venda' é o que faz toda chamada
 * antiga desta ação — e todo lugar do app que ainda não passa o parâmetro —
 * continuar criando exatamente a modelagem de sempre.
 *
 * ─── O que a locação ganha a mais ───────────────────────────────────────────
 * Duas CTEs condicionais, as duas guardadas por `WHERE tipo = 'locacao'`:
 *   o CABEÇALHO da locação, nos defaults da tabela;
 *   o PLANO DE CONTAS DA OPERAÇÃO, copiado do modelo de locação.
 *
 * Copiar do MODELO, e não repetir os literais aqui, é o que mantém uma fonte só:
 * quem acrescentar uma linha de OPEX ao modelo vê toda locação criada depois
 * nascer com ela. Sem modelo de locação na instalação, a modelagem nasce sem
 * linha de OPEX — e `opex_sem_linhas` acende âmbar, que é exatamente o aviso
 * certo, em vez de um plano de contas fantasma embutido em código.
 */
function createModelagem() {
  return action('createModelagem', 'SQL', {
    databaseName: 'provision',
    query: `
      WITH nova AS (
        INSERT INTO modelagens (
          empresa_id, projeto_id, nome, localizacao, tipo_uso, moeda, data_inicio,
          meses_aprovacao, meses_construcao, meses_pos_obra, horizonte_maximo,
          data_base, revisao, status, tipo_modelagem
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
          COALESCE('{{params.status}}', 'rascunho'),
          -- 'venda' é o default: toda chamada que não passa o parâmetro cria a
          -- modelagem de sempre. O CHECK da coluna rejeita qualquer outro valor.
          COALESCE(NULLIF('{{params.tipoModelagem}}', ''), 'venda')
        ) RETURNING id, tipo_modelagem
      ),
      cenario AS (
        INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline)
        SELECT id, 'Base', TRUE FROM nova
      ),
      fin AS (
        -- A PRIMEIRA facilidade, de ordem 0 (migration 1764200000). As demais
        -- nascem em "createModelagemFacilidade".
        INSERT INTO modelagem_financiamento (
          modelagem_id, ordem, nome, mes_inicio_saque, mes_fim_saque
        )
        SELECT id, 0, 'Financiamento', 1, GREATEST(
          COALESCE({{params.mesesAprovacao}}::int, 0)
          + COALESCE({{params.mesesConstrucao}}::int, 0)
          + COALESCE({{params.mesesPosObra}}::int, 0), 1)
        FROM nova
      ),
      rec AS (
        INSERT INTO modelagem_receita (modelagem_id) SELECT id FROM nova
      ),
      -- ─── Só no modo locação ────────────────────────────────────────────
      loc AS (
        INSERT INTO modelagem_locacao (modelagem_id)
        SELECT id FROM nova WHERE tipo_modelagem = 'locacao'
      ),
      opex AS (
        INSERT INTO modelagem_opex (modelagem_id, ordem, label, valor_sf_ano, reembolsavel)
        SELECT nova.id, o.ordem, o.label, 0, o.reembolsavel
        FROM nova
        JOIN modelagens modelo
          ON modelo.is_modelo AND modelo.tipo_modelagem = 'locacao'
        JOIN modelagem_opex o ON o.modelagem_id = modelo.id
        WHERE nova.tipo_modelagem = 'locacao'
      )
      SELECT id FROM nova
    `,
  });
}

export default createModelagem;
