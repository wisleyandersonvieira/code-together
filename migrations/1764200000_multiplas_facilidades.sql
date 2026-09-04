-- Modelagem Financeira — `modelagem_financiamento` deixa de ser 1:1.
--
-- Um projeto de locação quase sempre tem DUAS dívidas, e é a relação entre elas
-- que define o resultado: a construção sai numa facilidade cara e de prazo
-- curto, e quando o ativo estabiliza um permanent loan barato entra, QUITA a
-- primeira e fica no lugar dela. Sem modelar as duas, ou os juros ficam altos
-- demais o projeto inteiro, ou baixos demais a obra inteira.
--
-- É a mesma mudança estrutural do item "múltiplas facilidades" da análise de
-- lacunas, e vale também para o modo venda — um projeto de venda com mezanino
-- passa a caber aqui. Mas NENHUMA modelagem existente muda: todas passam a ter
-- exatamente uma facilidade, de `ordem` 0, com todos os campos novos nos
-- defaults inertes.
--
-- Idempotente: pode ser reaplicada.

-- ─── 5.1 A tabela ────────────────────────────────────────────────────────────
--
-- Sai o UNIQUE que amarrava uma facilidade por modelagem. O nome do constraint é
-- o que o Postgres gera para `modelagem_id INTEGER NOT NULL UNIQUE` na criação
-- da tabela (migration 1760800000).
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modelagem_id_key;

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nome VARCHAR(120) NOT NULL DEFAULT 'Financiamento',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  -- Refinanciamento: o saque desta facilidade quita o saldo daquela, no mes em
  -- que entra. Sem este vinculo o motor ve dois saques e nenhuma amortizacao.
  ADD COLUMN IF NOT EXISTS refinancia_facilidade_id INTEGER
    REFERENCES modelagem_financiamento(id) ON DELETE SET NULL;

COMMENT ON COLUMN modelagem_financiamento.ordem IS
  'Ordem de precedencia dentro do mes. Nos modos cash_demand e '
  'equity_first_demanda a demanda remanescente passa da facilidade 1 para a 2 '
  'nesta ordem — e por isso ela DEFINE o resultado, nao so a exibicao. '
  'Toda modelagem anterior a esta migration tem uma unica facilidade, de ordem 0.';

COMMENT ON COLUMN modelagem_financiamento.refinancia_facilidade_id IS
  'Auto-referencia: no primeiro mes em que ESTA facilidade saca, o saque e no '
  'minimo o saldo devedor da facilidade apontada (respeitando o proprio teto), e '
  'aquela amortiza exatamente esse valor no mesmo mes. A facilidade refinanciada '
  'fecha os juros do mes ANTES de esta sacar — senao sobra um residuo de juros '
  'que ninguem explica. Teto insuficiente acende refinanciamento_insuficiente em '
  'vermelho com a diferenca; ciclo (A refinancia B e B refinancia A) acende '
  'refinanciamento_circular e as duas linhas param de refinanciar. '
  'ATENCAO ao duplicar: e auto-referencial NA MESMA TABELA, como '
  'modelagem_custos.grupo_pai — copiar o valor direto amarra a copia na origem '
  'sem dar erro. Ver duplicar_modelagem.';

COMMENT ON COLUMN modelagem_financiamento.ativo IS
  'Facilidade desligada continua gravada com todos os campos e nao entra no '
  'fluxo. E o jeito de comparar cenarios sem apagar o que o usuario declarou.';

-- Com o UNIQUE fora, o lookup por modelagem perde o índice que vinha de graça.
CREATE INDEX IF NOT EXISTS idx_modelagem_financiamento_mod
  ON modelagem_financiamento(modelagem_id, ordem, id);

-- ─── 5.2 As chaves de override ───────────────────────────────────────────────
--
-- `draw` e `amortization` deixam de ser uma linha só e passam a ser uma POR
-- FACILIDADE: `draw:N` e `amortization:N`, com N sendo a posicao 1-based da
-- facilidade na ordem — a mesma convencao de indice que `unidadeIndex` e
-- `faseIndex` ja usam no motor, e nao o id da linha, que mudaria a cada
-- duplicacao.
--
-- VARCHAR(20) nao cabe `amortization:10`; VARCHAR(32) cabe com folga.
ALTER TABLE modelagem_overrides
  ALTER COLUMN linha TYPE VARCHAR(32);

ALTER TABLE modelagem_overrides
  DROP CONSTRAINT IF EXISTS modelagem_overrides_linha_check;

-- O CHECK deixa de ser uma lista fechada para `draw` e `amortization`: o numero
-- de facilidades e aberto. As demais linhas continuam fechadas — sao chaves
-- estaveis e um typo nelas tem de ser rejeitado no banco.
--
-- `draw` e `amortization` SEM sufixo continuam aceitos de proposito: o UPDATE
-- abaixo converte o que existe, mas uma replica atrasada, um restore de backup
-- ou um insert em transito ainda podem trazer a forma antiga, e rejeita-la
-- transformaria uma leitura degradada em erro. O motor trata a forma sem sufixo
-- como a facilidade 1 — exatamente o que ela sempre significou.
ALTER TABLE modelagem_overrides
  ADD CONSTRAINT modelagem_overrides_linha_check CHECK (
    linha IN (
      'land', 'construction', 'property_tax', 'other_costs', 'revenue',
      'equity_call', 'distribution', 'rental_revenue', 'opex',
      'draw', 'amortization'
    )
    OR linha ~ '^draw:[1-9][0-9]*$'
    OR linha ~ '^amortization:[1-9][0-9]*$'
  );

-- ─── A migração dos overrides existentes ─────────────────────────────────────
--
-- UPDATE explicito, e nao uma leitura tolerante no cliente: toda modelagem
-- gravada tem exatamente uma facilidade, a de ordem 0, que passa a ser a de
-- indice 1. Deixar a forma antiga no banco funcionaria — o motor a aceita — mas
-- criaria dois jeitos de escrever a mesma coisa, e a primeira gravacao de uma
-- celula ja editada produziria a chave nova ao lado da velha, com o UNIQUE
-- (modelagem_id, cenario_id, mes, linha) deixando as DUAS coexistirem.
--
-- NENHUM override e apagado. Se uma facilidade for removida depois, os overrides
-- dela ficam guardados e inativos, e a conferencia
-- `overrides_facilidade_removida` acende ambar.
--
-- A contagem vai para o log (RAISE NOTICE) e para o COMMENT da coluna: quem
-- auditar o banco depois consegue conferir quantas linhas mudaram de grafia sem
-- depender de ter guardado a saida da migration.
DO $$
DECLARE
  v_draw INT;
  v_amort INT;
BEGIN
  UPDATE modelagem_overrides SET linha = 'draw:1' WHERE linha = 'draw';
  GET DIAGNOSTICS v_draw = ROW_COUNT;

  UPDATE modelagem_overrides SET linha = 'amortization:1' WHERE linha = 'amortization';
  GET DIAGNOSTICS v_amort = ROW_COUNT;

  RAISE NOTICE 'Overrides migrados para o formato por facilidade: % em draw -> draw:1, % em amortization -> amortization:1 (total %).',
    v_draw, v_amort, v_draw + v_amort;

  EXECUTE format(
    'COMMENT ON COLUMN modelagem_overrides.linha IS %L',
    'Linha do fluxo em que a celula foi forcada. Chaves estaveis: nao renomear. '
    || 'draw e amortization sao POR FACILIDADE, no formato draw:N / amortization:N, '
    || 'com N sendo a posicao 1-based da facilidade na ordem (nao o id, que muda a '
    || 'cada duplicacao). A migration 1764200000 converteu ' || v_draw
    || ' override(s) de draw e ' || v_amort || ' de amortization para o formato novo, '
    || 'apontando para a facilidade de ordem 0 — a unica que existia. '
    || 'A forma sem sufixo continua aceita pelo CHECK e e lida pelo motor como '
    || 'facilidade 1, para replica atrasada e restore de backup nao virarem erro.'
  );
END $$;

-- ─── Nome das facilidades já gravadas ────────────────────────────────────────
--
-- O DEFAULT 'Financiamento' ja nomeia toda linha existente, e e o rotulo certo
-- para quem so tem uma. Nada a fazer aqui — o bloco existe para deixar
-- registrado que a omissao e deliberada, nao esquecimento.
