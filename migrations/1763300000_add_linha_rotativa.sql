-- Modelagem Financeira — linha de crédito rotativa.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. Capacidade de saque, pico de saldo devedor e LTC são DERIVADOS pelo
-- motor a cada cálculo e nunca gravados.
--
-- O problema: até aqui o teto de dívida (max_ltc_pct ou valor_contratado) era
-- sempre comparado com o TOTAL DESEMBOLSADO ao longo da vida do empréstimo, e a
-- capacidade nunca se recompunha quando a dívida era amortizada. Numa linha
-- revolvente de construção isso está errado: quem amortiza $5M com a venda de
-- um lote pode sacar esses $5M de novo, e o que o contrato limita é a POSIÇÃO
-- EM ABERTO, não a soma histórica dos saques.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. FALSE
-- é o default e é exatamente o comportamento anterior a esta migration — o
-- caminho novo é inalcançável para toda linha já gravada. Quem liga é o usuário,
-- na modelagem dele.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS linha_rotativa BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN modelagem_financiamento.linha_rotativa IS
  'TRUE = linha de crédito rotativa: amortizar devolve limite, e a capacidade do '
  'mês é teto − saldo devedor de abertura. FALSE (default, comportamento '
  'anterior) = facilidade não rotativa: o teto vale para o TOTAL desembolsado ao '
  'longo da vida do empréstimo. '
  'Muda também o que a conferência teto_divida cobra: com TRUE, o PICO do saldo '
  'devedor contra o teto; com FALSE, o total sacado contra o teto. '
  'A capacidade usa sempre o saldo de ABERTURA do mês, nunca o saldo depois do '
  'saque ou da amortização do próprio mês — é a leitura contratual (o pedido é '
  'avaliado contra a posição em aberto no momento do pedido) e a única que não '
  'cria circularidade entre saque e capacidade.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
