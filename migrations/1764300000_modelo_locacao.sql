-- Modelagem Financeira — a modelagem MODELO de LOCAÇÃO.
--
-- A migration 1763600000 semeou UM modelo, e ele é de venda. O modo locação
-- precisa do seu: o plano de contas do desenvolvimento é o mesmo, mas a operação
-- do ativo — as linhas de OPEX — não existe do outro lado.
--
-- Um modelo POR TIPO, e é isso que o índice abaixo passa a dizer.
--
-- Idempotente: só semeia se ainda não houver modelo de locação. Reaplicar não
-- cria um segundo nem duplica linha nenhuma.

-- ─── O índice único, agora por tipo ──────────────────────────────────────────
--
-- O índice da 1763500000 indexava a constante TRUE e por isso admitia UMA
-- modelagem modelo na instalação inteira. Com dois modos de negócio a chave
-- passa a ser o TIPO: as linhas com `is_modelo` disputam a chave
-- `tipo_modelagem`, e sobra exatamente uma de cada.
--
-- O DROP vem ANTES do INSERT, obviamente: com o índice antigo no lugar, a
-- segunda modelagem modelo seria rejeitada.
DROP INDEX IF EXISTS idx_modelagens_modelo_unico;

CREATE UNIQUE INDEX IF NOT EXISTS idx_modelagens_modelo_unico_por_tipo
  ON modelagens (tipo_modelagem) WHERE is_modelo;

COMMENT ON INDEX idx_modelagens_modelo_unico_por_tipo IS
  'No maximo UMA modelagem modelo por tipo_modelagem. Substitui o indice sobre '
  'a constante TRUE da migration 1763500000, que admitia uma so na instalacao '
  'inteira — insuficiente desde que existem dois modos de negocio.';

-- ─── O modelo ────────────────────────────────────────────────────────────────
WITH nova AS (
  INSERT INTO modelagens (
    empresa_id, projeto_id, nome, moeda, data_inicio,
    meses_aprovacao, meses_construcao, meses_pos_obra, status,
    is_modelo, tipo_modelagem
  )
  SELECT
    NULL, NULL, 'Modelo — locação', 'USD',
    date_trunc('month', CURRENT_DATE)::date,
    0, 0, 0, 'modelo', TRUE, 'locacao'
  WHERE NOT EXISTS (
    SELECT 1 FROM modelagens WHERE is_modelo AND tipo_modelagem = 'locacao'
  )
  RETURNING id
),
-- As linhas 1:1 que `createModelagem` também cria. Sem o cenário base nenhum
-- override tem onde ancorar; sem financiamento e receita o mapeador cai em
-- defaults silenciosos e a modelagem abre diferente do que foi gravada.
cenario AS (
  INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline)
  SELECT id, 'Base', TRUE FROM nova
),
fin AS (
  INSERT INTO modelagem_financiamento (modelagem_id, ordem, nome, mes_inicio_saque, mes_fim_saque)
  SELECT id, 0, 'Construção', 1, 1 FROM nova
),
rec AS (
  INSERT INTO modelagem_receita (modelagem_id) SELECT id FROM nova
),
-- O cabeçalho da locação nos defaults da tabela: tudo zerado e ocupação
-- estabilizada em 100%. Um modelo carrega ESTRUTURA, não números — cap rate,
-- reembolso e perda de crédito são premissas do projeto real.
loc AS (
  INSERT INTO modelagem_locacao (modelagem_id) SELECT id FROM nova
),
-- ─── O plano de contas do DESENVOLVIMENTO ───────────────────────────────────
-- Copiado do modelo de VENDA em vez de reescrito: o orçamento de obra é o mesmo
-- nos dois modos, e manter duas listas literais garantiria que elas divergissem
-- na primeira linha que alguém acrescentasse de um lado só.
--
-- Consequência deliberada: se o usuário já editou o plano de contas do modelo de
-- venda, o de locação nasce com essas edições. É o comportamento certo — é o
-- plano de contas DA INSTALAÇÃO.
custos AS (
  INSERT INTO modelagem_custos (
    modelagem_id, ordem, label, categoria, base_calculo, grupo_referencia,
    gatilho, distribuicao, valor, valor_unitario, percentual, grupo_pai, mes_ancora
  )
  SELECT
    nova.id, c.ordem, c.label, c.categoria, c.base_calculo, c.grupo_referencia,
    c.gatilho, c.distribuicao, 0, 0, 0, NULL, NULL
  FROM nova
  JOIN modelagens mv ON mv.is_modelo AND mv.tipo_modelagem = 'venda'
  JOIN modelagem_custos c ON c.modelagem_id = mv.id
),
-- ─── O plano de contas da OPERAÇÃO ──────────────────────────────────────────
-- Esta é a lista canônica das linhas de OPEX, e a ÚNICA no repositório:
-- `createModelagem` copia daqui, do modelo, em vez de repetir os literais. Se
-- alguém acrescentar uma linha ao modelo, toda locação criada depois já nasce
-- com ela — que é exatamente o que um plano de contas deve fazer.
--
-- Todas nascem com valor ZERO: o usuário preenche.
--
-- `reembolsavel` é a única coluna com conteúdo de verdade aqui, e a exceção é a
-- que importa: reserva de reposição (CapEx) é despesa do PROPRIETÁRIO, não do
-- ocupante, e não entra na base do reembolso NNN. Marcá-la como reembolsável
-- inflaria o NOI em toda a curva de ocupação.
plano_opex (ordem, label, reembolsavel) AS (
  VALUES
    (1, 'Administração predial',            TRUE),
    (2, 'Manutenção e conservação',         TRUE),
    (3, 'Property taxes',                   TRUE),
    (4, 'Seguro predial',                   TRUE),
    (5, 'Utilidades das áreas comuns',      TRUE),
    (6, 'Segurança, limpeza e paisagismo',  TRUE),
    (7, 'Reserva de reposição (CapEx)',     FALSE),
    (8, 'Outras despesas operacionais',     TRUE)
)
INSERT INTO modelagem_opex (modelagem_id, ordem, label, valor_sf_ano, reembolsavel)
SELECT nova.id, p.ordem, p.label, 0, p.reembolsavel
FROM nova CROSS JOIN plano_opex p;

-- ─── Property tax, e por que ele aparece dos DOIS lados ─────────────────────
--
-- O plano de custos copiado do modelo de venda tem uma linha 'Property Tax'
-- (soft cost, gatilho inicio_obra), e o plano de OPEX tem 'Property taxes'. Não
-- é duplicidade: são impostos de FASES diferentes — o do terreno durante a obra
-- é custo de desenvolvimento, o do prédio operando é despesa operacional que
-- entra na base do reembolso NNN.
--
-- A duplicidade que o motor de fato precisa evitar é outra: a coluna
-- `modelagem_unidades.property_tax_ano`, que no modo locação é IGNORADA em favor
-- da linha de OPEX. A conferência `property_tax_duplicado` acende âmbar quando
-- ela está preenchida.
