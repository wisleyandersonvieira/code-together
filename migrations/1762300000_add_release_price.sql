-- Modelagem Financeira — release price por unidade vendida.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. A amortização de cada mês é DERIVADA pelo motor a partir das unidades
-- que fecham naquele mês, e nunca gravada.
--
-- Num construction loan americano, cada lote vendido libera um valor fixo para o
-- banco: o saldo devedor cai em degraus a cada takedown, sem amortização
-- programada. Até aqui a dívida só amortizava no mês da saída ou por override.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Com
-- release_price = 0 e release_price_pct NULL não há release nenhum, e a
-- amortização é exatamente a de hoje.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS release_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS release_price_pct DECIMAL(9,6);

COMMENT ON COLUMN modelagem_financiamento.release_price IS
  'Valor FIXO liberado ao banco por unidade vendida. A amortização do mês ganha '
  'release_price × unidades que fecham naquele mês, SOMADA à amortização do modo '
  'escolhido. Tem PRECEDÊNCIA sobre release_price_pct quando os dois estiverem '
  'preenchidos. DEFAULT 0 = sem release, comportamento anterior a esta migration.';

COMMENT ON COLUMN modelagem_financiamento.release_price_pct IS
  'Alternativa ao valor fixo: FRAÇÃO do preço de venda das unidades que fecham no '
  'mês (0.300000 = 30%). Mesma convenção de comissao_pct. Só é lido quando '
  'release_price = 0 — ver o COMMENT daquela coluna. NULL = não usar.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
