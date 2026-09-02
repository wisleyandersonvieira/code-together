-- Modelagem Financeira — semeia a modelagem MODELO com o plano de contas.
--
-- O que esta migration cria é a ESTRUTURA do orçamento, não os números: toda
-- linha nasce com valor, valor_unitario e percentual zerados. O usuário duplica
-- o modelo e preenche; o que ele não usar, apaga. É a mesma lógica de um plano
-- de contas contábil — a conta existe antes de ter saldo.
--
-- ─── O que ficou DE FORA, e por quê ──────────────────────────────────────────
-- Duas famílias de custo NÃO entram aqui, e cadastrá-las contaria o mesmo
-- dinheiro duas vezes no fluxo de caixa:
--
--   TERRENO e CONSTRUÇÃO VERTICAL — são colunas das tipologias
--   (`modelagem_unidades.custo_terreno` e `custo_obra`, aba Unidades). O motor
--   soma as duas em `terrenosTotal`/`obraTotal` e elas já formam o custo direto.
--
--   CLOSING COSTS, INTEREST RESERVE, LENDER FEE, FINANCE FEE e INSPECTION
--   RESERVE — são campos da aba Financiamento (`reserva_juros`,
--   `fee_estruturacao_pct` e afins). O motor já os lança como custo financeiro.
--
-- Quem for tentado a acrescentá-los como linha de custo: o número apareceria
-- duas vezes na apuração, e a conferência `caixa_final_sponsor` acusaria a
-- diferença sem dizer a causa.
--
-- ─── Sobre gatilho 'mes_fixo' sem mês âncora ─────────────────────────────────
-- A maioria das linhas soft nasce com gatilho 'mes_fixo' e SEM `mes_ancora`, e
-- isso é DELIBERADO: sem âncora o motor não lança nada (ver o passo do gatilho
-- em motor.ts), e a conferência `custo_gatilho_nao_lancado` avisa. É o
-- comportamento certo para um modelo, que não tem cronograma nenhum.
--
-- NÃO "conserte" isto preenchendo mês 1 em tudo: o resultado seria um modelo
-- que despeja o orçamento inteiro no primeiro mês da modelagem duplicada, e o
-- usuário só descobriria olhando o fluxo. Sem âncora, o número fica visivelmente
-- zerado até alguém decidir quando ele vence.
--
-- `distribuicao` das linhas com gatilho 'mes_fixo' e 'inicio_obra' é INERTE — o
-- gatilho substitui a distribuição (ver EXPLICACAO_GATILHO em tipos.ts). Fica no
-- DEFAULT da coluna, 'linear_construction', que também satisfaz o CHECK de
-- âncora (só 'single_month' exige `mes_ancora`).
--
-- Idempotente: só semeia se ainda não houver nenhuma modelagem com is_modelo.
-- Reaplicar não cria um segundo modelo nem duplica linha de custo.

WITH nova AS (
  INSERT INTO modelagens (
    empresa_id, projeto_id, nome, moeda, data_inicio,
    meses_aprovacao, meses_construcao, meses_pos_obra, status, is_modelo
  )
  SELECT
    NULL, NULL, 'Modelo — plano de contas', 'USD',
    -- Primeiro dia do mês corrente: o modelo não tem cronograma real, e uma data
    -- redonda deixa claro que ela é de partida, não de projeto.
    date_trunc('month', CURRENT_DATE)::date,
    0, 0, 0, 'modelo', TRUE
  WHERE NOT EXISTS (SELECT 1 FROM modelagens WHERE is_modelo)
  RETURNING id
),
-- As três linhas que `createModelagem` também cria. Sem o cenário base nenhum
-- override tem onde ancorar; sem as linhas 1:1 de financiamento e receita o
-- mapeador cai em defaults silenciosos e a modelagem abre diferente do que foi
-- gravada.
cenario AS (
  INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline)
  SELECT id, 'Base', TRUE FROM nova
),
fin AS (
  INSERT INTO modelagem_financiamento (modelagem_id, mes_inicio_saque, mes_fim_saque)
  SELECT id, 1, 1 FROM nova
),
rec AS (
  INSERT INTO modelagem_receita (modelagem_id) SELECT id FROM nova
),
-- ─── O plano de contas ──────────────────────────────────────────────────────
-- Ordem sequencial e estável: é ela que a aba Custos usa para exibir, e mexer
-- nela depois embaralharia o orçamento de quem já duplicou.
plano (ordem, label, categoria, base_calculo, grupo_referencia, gatilho, distribuicao) AS (
  VALUES
    -- Sitework
    ( 1, 'Sitework',                        'sitework',     'por_unidade',  NULL,       'mes_fixo',   'linear_construction'),
    ( 2, 'Lift Station',                    'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    ( 3, 'Power',                           'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    ( 4, 'Environmental (Clean Up)',        'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    ( 5, 'Material Testing',                'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    ( 6, 'Main Entrance Sign',              'sitework',     'total',        NULL,       'mes_fixo',   'linear_construction'),
    ( 7, 'Secondary Sign',                  'sitework',     'total',        NULL,       'mes_fixo',   'linear_construction'),
    ( 8, 'Hardscape / Landscape',           'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    ( 9, 'Irrigation',                      'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    (10, 'Walls / Fencing',                 'sitework',     'total',        NULL,       'cronograma', 'linear_construction'),
    -- Amenidades
    (11, 'Clubhouse / Amenities',           'amenidades',   'total',        NULL,       'cronograma', 'linear_construction'),
    -- Offsite
    (12, 'Offsite Improvement',             'offsite',      'total',        NULL,       'cronograma', 'linear_construction'),
    -- Contingência: incide sobre uma CATEGORIA (grupo_referencia é o nome da
    -- categoria, não o id de um custo) — por isso não há grupo_pai aqui.
    (13, 'Contingency — Sitework',          'contingencia', 'pct_de_grupo', 'sitework', 'cronograma', 'linear_construction'),
    (14, 'Contingency — Vertical',          'contingencia', 'pct_de_grupo', 'vertical', 'cronograma', 'linear_construction'),
    -- Soft costs
    (15, 'Fees & Permit',                   'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (16, 'Municipal Fees — Other',          'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (17, 'Bonds / Fees',                    'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (18, 'Phase I ESA',                     'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (19, 'Phase II ESA',                    'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (20, 'Geotech',                         'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (21, 'Traffic Study',                   'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (22, 'Survey',                          'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (23, 'Land Planner',                    'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (24, 'Cultural Resource Survey',        'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (25, 'Inspections / Testing',           'soft',         'total',        NULL,       'cronograma',  'linear_construction'),
    (26, 'Landscape Architect',             'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (27, 'Civil Engineering',               'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (28, 'Arquitetura / Estrutural / MEP',  'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (29, 'Builder''s Risk / GL Insurance',  'soft',         'total',        NULL,       'cronograma',  'linear_construction'),
    (30, 'Impact Fees',                     'soft',         'por_unidade',  NULL,       'mes_fixo',    'linear_construction'),
    (31, 'Water / Sewer Fees',              'soft',         'total',        NULL,       'inicio_obra', 'linear_construction'),
    (32, 'Legal',                           'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (33, 'Platting',                        'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (34, 'Property Tax',                    'soft',         'total',        NULL,       'inicio_obra', 'linear_construction'),
    (35, 'Overhead — Developer',            'soft',         'total',        NULL,       'cronograma',  'linear_total'),
    (36, 'Marketing & Sales',               'soft',         'total',        NULL,       'cronograma',  'linear_total'),
    (37, 'CDD Set Up Costs',                'soft',         'total',        NULL,       'mes_fixo',    'linear_construction'),
    (38, 'Other Soft Costs — Contingency',  'soft',         'total',        NULL,       'cronograma',  'linear_construction')
)
INSERT INTO modelagem_custos (
  modelagem_id, ordem, label, categoria, base_calculo, grupo_referencia,
  gatilho, distribuicao, valor, valor_unitario, percentual, grupo_pai, mes_ancora
)
SELECT
  nova.id, p.ordem, p.label, p.categoria, p.base_calculo, p.grupo_referencia,
  p.gatilho, p.distribuicao,
  -- O modelo carrega a ESTRUTURA, não os números.
  0, 0, 0,
  -- Sem agrupamento e sem âncora: os dois são decisão da modelagem real.
  NULL, NULL
FROM nova CROSS JOIN plano p;
