-- Modelagem Financeira — base de cálculo do custo: total, por unidade, por pé quadrado.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. O valor DERIVADO (unitário × denominador) é recalculado pelo motor puro
-- a cada cálculo e nunca gravado.
--
-- Até aqui `modelagem_custos.valor` era sempre um total digitado. Uma pro forma
-- real digita o custo unitário e deriva o total: a construção vertical é lançada
-- como $385.200 por unidade, que são $214/sf sobre 1.800 sf. Sem isto, mudar de
-- 45 para 60 unidades obriga a refazer a conta fora do sistema.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. O
-- DEFAULT 'total' faz o motor ler `valor` exatamente como lia antes, e
-- valor_unitario DEFAULT 0 fica inerte enquanto a base for 'total'.
--
-- Idempotente: pode ser reaplicada.

-- ─── Base de cálculo ─────────────────────────────────────────────────────────
ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS base_calculo VARCHAR(20) NOT NULL DEFAULT 'total';

-- CHECK à parte do ADD COLUMN, pelo mesmo motivo da 1761200000: com
-- IF NOT EXISTS, reaplicar numa base que já tem a coluna pularia a constraint
-- embutida.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_custos_base_calculo_ck'
  ) THEN
    ALTER TABLE modelagem_custos
      ADD CONSTRAINT modelagem_custos_base_calculo_ck
        CHECK (base_calculo IN ('total', 'por_unidade', 'por_sf'));
  END IF;
END $$;

-- DECIMAL(15,4), e não (15,2): $/sf é uma grandeza de precisão fina — arredondar
-- $214,3750/sf para $214,38 sobre 81.000 sf erra o orçamento em mais de $400.
ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS valor_unitario DECIMAL(15,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN modelagem_custos.base_calculo IS
  '''total'' (default) = `valor` é o total digitado, comportamento anterior a esta '
  'migration. ''por_unidade'' = valor_unitario × Σ modelagem_unidades.quantidade. '
  '''por_sf'' = valor_unitario × Σ (area_sf × quantidade). '
  'ATENÇÃO: quando base_calculo <> ''total'', a coluna `valor` passa a ser DERIVADA '
  'e NÃO deve ser lida como input — o app não a atualiza e ela guarda o último '
  'total digitado enquanto a base ainda era ''total''. Quem precisa do número '
  'efetivo chama valorEfetivoCusto() em lib/modelagem/motor.ts; o valor derivado '
  'nunca é persistido.';

COMMENT ON COLUMN modelagem_custos.valor_unitario IS
  'Custo por unidade ou por pé quadrado, conforme base_calculo. Inerte (e '
  'ignorado pelo motor) quando base_calculo = ''total''. DEFAULT 0 para que toda '
  'linha anterior a esta migration continue produzindo o mesmo ModelOutput.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- modelagem_custos já nasceu com RLS habilitado e sem policy na 1760800000, e
-- não há tabela nova aqui. Reafirmado por ser idempotente e para que a migration
-- continue correta se for aplicada fora de ordem.
ALTER TABLE modelagem_custos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_custos FROM anon;
