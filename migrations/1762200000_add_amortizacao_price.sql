-- Modelagem Financeira — carência, prestação e balloon.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. A prestação e o balloon são DERIVADOS pelo motor a cada cálculo e nunca
-- gravados — a prestação, aliás, é recalculada a cada saque novo, e persistir o
-- número congelaria uma conta que precisa acompanhar o principal.
--
-- Até aqui só existiam 'at_exit' (tudo no mês da saída) e 'manual'. Uma dívida
-- real tem prazo, meses de carência (interest-only), prestação e balloon no
-- vencimento.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. 'price'
-- e 'sac' são modos NOVOS: nenhuma linha existente os tem, então o caminho novo
-- é inalcançável para o que já está gravado. Os DEFAULTS das colunas novas
-- (carencia_meses = 0, balloon = TRUE) só têm efeito dentro dos modos novos.
--
-- Idempotente: pode ser reaplicada.

-- O CHECK da 1760800000 é inline e sem nome, então o Postgres o batizou de
-- modelagem_financiamento_modo_amortizacao_check. Os dois DROP IF EXISTS cobrem
-- o nome automático e o nome novo, o que torna a migration reaplicável.
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modo_amortizacao_check;
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modo_amortizacao_ck;
ALTER TABLE modelagem_financiamento
  ADD CONSTRAINT modelagem_financiamento_modo_amortizacao_ck
    CHECK (modo_amortizacao IN ('at_exit', 'manual', 'price', 'sac'));

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS prazo_meses INTEGER,
  ADD COLUMN IF NOT EXISTS carencia_meses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amortizacao_meses INTEGER,
  ADD COLUMN IF NOT EXISTS balloon_no_vencimento BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN modelagem_financiamento.prazo_meses IS
  'Prazo da dívida em meses, contado a partir de mes_inicio_saque. O vencimento '
  'cai em mes_inicio_saque + prazo_meses - 1. NULL = sem vencimento declarado, e '
  'nesse caso não há balloon. Só tem efeito com modo_amortizacao ''price'' ou ''sac''.';

COMMENT ON COLUMN modelagem_financiamento.carencia_meses IS
  'Meses de carência (interest-only) contados de mes_inicio_saque: dentro deles a '
  'amortização é ZERO e só os juros correm. DEFAULT 0. Só tem efeito nos modos '
  '''price'' e ''sac''.';

COMMENT ON COLUMN modelagem_financiamento.amortizacao_meses IS
  'Prazo de AMORTIZAÇÃO, que pode ser MAIOR que prazo_meses — e é justamente essa '
  'diferença que gera o balloon: a prestação é dimensionada para quitar em N '
  'meses, mas a dívida vence antes e o saldo remanescente é liquidado de uma vez. '
  'Exemplo clássico: prazo 20, amortização 300. NULL cai em prazo_meses.';

COMMENT ON COLUMN modelagem_financiamento.balloon_no_vencimento IS
  'TRUE (default): no mês do vencimento todo o saldo remanescente é amortizado de '
  'uma vez. FALSE: a dívida simplesmente para de amortizar no vencimento e o '
  'saldo fica em aberto — a conferência saldo_devedor_final acusa em vermelho.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
