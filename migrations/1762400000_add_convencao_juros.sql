-- Modelagem Financeira — convenção de contagem de juros.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. O fator de juros de cada mês é DERIVADO pelo motor a partir da convenção
-- e da data do mês, e nunca gravado.
--
-- Até aqui o juro do mês era sempre saldo × (taxa_anual / 12). Um contrato real
-- conta os dias do mês (28/30/31) sobre base 360 ou 365. Sobre base 360 a
-- diferença chega a ~1,4% no juro do ano — em US$ 24 milhões de saque, são dezenas
-- de milhares de dólares que o banco cobra e o modelo não previa.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. O
-- DEFAULT 'mensal_12' é literalmente taxa_anual / 12, a conta de hoje.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS convencao_juros VARCHAR(12) NOT NULL DEFAULT 'mensal_12';

-- CHECK à parte do ADD COLUMN, pelo mesmo motivo da 1761200000: com
-- IF NOT EXISTS, reaplicar numa base que já tem a coluna pularia a constraint
-- embutida.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_financiamento_convencao_juros_ck'
  ) THEN
    ALTER TABLE modelagem_financiamento
      ADD CONSTRAINT modelagem_financiamento_convencao_juros_ck CHECK (convencao_juros IN (
        'mensal_12', '30_360', 'actual_360', 'actual_365'
      ));
  END IF;
END $$;

COMMENT ON COLUMN modelagem_financiamento.convencao_juros IS
  'Como o juro do mês é contado. ''mensal_12'' (DEFAULT) = taxa_anual / 12, a conta '
  'anterior a esta migration. ''30_360'' = taxa × 30 / 360, que é aritmeticamente '
  'o MESMO número de mensal_12 e existe só para o usuário declarar a convenção do '
  'contrato. ''actual_360'' = taxa × dias do mês / 360, a mais cara: 365 dias sobre '
  'base 360 dá ~1,39% a mais de juros no ano. ''actual_365'' = taxa × dias do mês / '
  '365. Os dias saem da data do mês, derivada de modelagens.data_inicio.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
