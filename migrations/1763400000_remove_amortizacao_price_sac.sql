-- Modelagem Financeira — remoção dos modos de amortização 'price' e 'sac'.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. A amortização de cada mês é DERIVADA pelo motor e nunca gravada.
--
-- Contexto: a 1762200000 introduziu 'price' (prestação constante) e 'sac'
-- (principal constante), com carência, vencimento e balloon. Depois disso o
-- passo 3 do motor passou a ser apenas o release por unidade vendida mais a
-- quitação no mês da saída, e a partir dali 'price' e 'sac' deixaram de ter
-- comportamento próprio: produziam EXATAMENTE o mesmo ModelOutput que 'manual'.
-- Dois modos que não fazem nada de diferente do terceiro são armadilha na tela —
-- quem escolhe 'price' espera uma prestação que o motor não calcula.
--
-- Por que 'manual' e não 'at_exit': 'manual' é o que essas linhas JÁ produzem —
-- nenhuma amortização automática além do release. Converter para 'at_exit'
-- acrescentaria uma quitação integral no mês da saída que essas modelagens nunca
-- tiveram, e mudaria o saldo devedor, o custo financeiro e o caixa de todas
-- elas. A conversão abaixo, portanto, NÃO muda o resultado de nenhuma modelagem.
--
-- lib/modelagem/mapear.ts repete essa mesma tradução em código, para o caso de a
-- aplicação subir antes desta migration ou ler uma réplica atrasada.
--
-- As colunas prazo_meses, carencia_meses, amortizacao_meses e
-- balloon_no_vencimento NÃO são removidas: continuam gravadas e inertes. Quem
-- for reintroduzir prestação encontra os dados como o usuário os deixou.
--
-- Idempotente: pode ser reaplicada.

-- ─── 1. Converter as linhas ANTES de apertar o CHECK ─────────────────────────
-- Nesta ordem, e não na inversa: com o CHECK novo já em vigor, o UPDATE falharia
-- na validação das linhas que ele existe para corrigir.
UPDATE modelagem_financiamento
   SET modo_amortizacao = 'manual'
 WHERE modo_amortizacao IN ('price', 'sac');

-- ─── 2. Apertar o CHECK ──────────────────────────────────────────────────────
-- Os DROP IF EXISTS cobrem o nome automático da 1760800000 e o nome explícito da
-- 1762200000, o que torna a migration reaplicável.
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modo_amortizacao_check;
ALTER TABLE modelagem_financiamento
  DROP CONSTRAINT IF EXISTS modelagem_financiamento_modo_amortizacao_ck;
ALTER TABLE modelagem_financiamento
  ADD CONSTRAINT modelagem_financiamento_modo_amortizacao_ck
    CHECK (modo_amortizacao IN ('at_exit', 'manual'));

COMMENT ON COLUMN modelagem_financiamento.modo_amortizacao IS
  'Como a dívida é quitada. ''at_exit'' (default) = todo o saldo remanescente sai '
  'no mês da saída. ''manual'' = nenhuma amortização automática, só overrides. '
  'Em qualquer um dos dois, o release por unidade vendida amortiza no mês da '
  'venda: release é cláusula do contrato, não modo de amortização. '
  '''price'' e ''sac'' existiram entre as migrations 1762200000 e 1763400000 e '
  'foram removidos; as linhas que os tinham viraram ''manual'', sem mudança de '
  'resultado.';

-- ─── 3. As colunas da prestação ficam, marcadas como inertes ─────────────────
COMMENT ON COLUMN modelagem_financiamento.prazo_meses IS
  'INERTE desde a migration 1763400000: não entra no fluxo nem em conferência '
  'nenhuma. Guardada para não perder o que o usuário declarou e para quem for '
  'reintroduzir amortização por prestação.';

COMMENT ON COLUMN modelagem_financiamento.carencia_meses IS
  'INERTE desde a migration 1763400000 — ver o COMMENT de prazo_meses.';

COMMENT ON COLUMN modelagem_financiamento.amortizacao_meses IS
  'INERTE desde a migration 1763400000 — ver o COMMENT de prazo_meses.';

COMMENT ON COLUMN modelagem_financiamento.balloon_no_vencimento IS
  'INERTE desde a migration 1763400000 — ver o COMMENT de prazo_meses.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_financiamento FROM anon;
