-- Modelagem Financeira — modo de saque 'equity_first_demanda'.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. O saque de cada mês é DERIVADO pelo motor a cada cálculo e nunca gravado.
--
-- O problema que o modo novo resolve: no 'equity_first' o saque do mês é
-- limitado à OBRA do mês (min(construction[m], capacidade)). Terreno, property
-- tax, custos do orçamento, juros e fee ficam sem cobertura de dívida, e como o
-- aporte no modo 'plano' é a parcela do mês — não o resíduo do caixa — o caixa
-- acumulado fica negativo. O modo novo mantém a ordem "capital próprio primeiro"
-- (o aporte do mês é descontado da demanda) mas dimensiona o saque pelo que
-- FALTA para pagar o mês e manter o colchão.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado.
-- 'equity_first_demanda' é um modo NOVO: nenhuma linha existente o tem, então o
-- caminho novo é inalcançável para o que já está gravado. Nenhuma linha muda,
-- nenhum default muda — o default da coluna continua 'equity_first'.
--
-- Idempotente: pode ser reaplicada.

-- O CHECK da 1760800000 é inline e sem nome, então o Postgres o batizou de
-- modelagem_financiamento_modo_saque_check. Os dois DROP IF EXISTS cobrem o nome
-- automático e o nome novo, o que torna a migration reaplicável.
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modo_saque_check;
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modo_saque_ck;
ALTER TABLE modelagem_financiamento
  ADD CONSTRAINT modelagem_financiamento_modo_saque_ck
    CHECK (modo_saque IN ('equity_first', 'cash_demand', 'manual', 'equity_first_demanda'));

COMMENT ON COLUMN modelagem_financiamento.modo_saque IS
  'Como o saque de cada mês é dimensionado. '
  '''equity_first'' (default, comportamento anterior a esta migration) = o capital '
  'próprio entra primeiro na obra e o saque é limitado à OBRA do mês. '
  '''cash_demand'' = o saque cobre a demanda de caixa do mês, IGNORANDO o aporte '
  'do próprio mês. '
  '''equity_first_demanda'' = o saque cobre a demanda do mês DESCONTADO o aporte '
  'previsto para o mesmo mês; o caixa fecha no colchão em vez de ficar negativo. '
  '''manual'' = nenhum saque automático, só overrides.';

-- Uso recomendado do modo novo: com custo_financeiro_na_demanda = TRUE. Com ela
-- FALSE os juros do mês continuam saindo do caixa sem entrar no dimensionamento
-- do saque, e o caixa não fecha no colchão — a conferência
-- custo_financeiro_fora_da_demanda acusa em âmbar. A coluna NÃO muda de default
-- aqui: quem liga é a interface, ao selecionar o modo, e apenas para a modelagem
-- que o usuário estiver editando.

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
