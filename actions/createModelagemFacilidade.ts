import { action } from '@uibakery/data';

/**
 * Cria uma facilidade de crédito adicional (migration 1764200000).
 *
 * A PRIMEIRA facilidade nasce junto com a modelagem, em `createModelagem`; esta
 * ação é para as demais — o mezanino de um projeto de venda, o permanent loan
 * que refinancia a construção num projeto de locação.
 *
 * `ordem` não é decoração: é a precedência da demanda de caixa dentro do mês, e
 * é ela que define quanto cada banco empresta. Nasce no fim da lista, que é o
 * único lugar em que acrescentar uma facilidade não muda o resultado das que já
 * existem.
 *
 * `refinancia_facilidade_id` NÃO é gravada aqui, e é deliberado: a facilidade que
 * ela refinanciaria pode ser a que está sendo criada agora (ou uma criada logo
 * depois), e um id que ainda não existe faria a FK estourar. O vínculo é
 * declarado pelo `saveModelagemFinanciamento`, quando as duas já existem.
 */
function createModelagemFacilidade() {
  return action('createModelagemFacilidade', 'SQL', {
    databaseName: 'provision',
    query: `
      INSERT INTO modelagem_financiamento (
        modelagem_id, ordem, nome, ativo, mes_inicio_saque, mes_fim_saque
      )
      SELECT
        m.id,
        -- Fim da lista: MAX(ordem) + 1, ou 0 se esta for a primeira.
        COALESCE(
          {{params.ordem}}::int,
          (SELECT COALESCE(MAX(f.ordem) + 1, 0)
             FROM modelagem_financiamento f WHERE f.modelagem_id = m.id)
        ),
        COALESCE(NULLIF('{{params.nome}}', ''), 'Financiamento'),
        TRUE,
        COALESCE({{params.mesInicioSaque}}::int, 1),
        -- Janela até o fim do cronograma, e não até o mês 1: uma facilidade que
        -- nasce com a janela fechada não saca nada, e o usuário passaria a
        -- procurar o erro no modo de saque.
        COALESCE(
          {{params.mesFimSaque}}::int,
          GREATEST(m.meses_aprovacao + m.meses_construcao + m.meses_pos_obra, 1)
        )
      FROM modelagens m
      WHERE m.id = {{params.modelagemId}}::int
      RETURNING id
    `,
  });
}

export default createModelagemFacilidade;
