-- Modelagem Financeira — despesa como percentual de um grupo do orçamento.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. O valor derivado (percentual × base do grupo) é recalculado pelo motor
-- puro a cada cálculo e NUNCA gravado — é justamente esse o ponto do item: a
-- contingência de 5% dos hard costs sobe sozinha quando a obra sobe, sem que
-- ninguém precise lembrar de refazer a conta a cada revisão.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Nenhuma
-- linha existente tem base_calculo = 'pct_de_grupo' (o default é 'total'), então
-- o caminho novo é inalcançável para o que já está gravado.
--
-- Idempotente: pode ser reaplicada.

-- ─── 'pct_de_grupo' entra no CHECK de base_calculo ───────────────────────────
-- DROP + ADD porque não existe "ALTER CONSTRAINT ... ADD VALUE" para CHECK. O
-- DROP é IF EXISTS e o ADD só acontece depois, então reaplicar é seguro.
ALTER TABLE modelagem_custos
  DROP CONSTRAINT IF EXISTS modelagem_custos_base_calculo_ck;

ALTER TABLE modelagem_custos
  ADD CONSTRAINT modelagem_custos_base_calculo_ck
    CHECK (base_calculo IN ('total', 'por_unidade', 'por_sf', 'pct_de_grupo'));

-- ─── Grupo de referência e percentual ────────────────────────────────────────
ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS grupo_referencia VARCHAR(40);

ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS percentual DECIMAL(9,6) NOT NULL DEFAULT 0;

DO $$
BEGIN
  -- Mesma lista de `categoria`: o grupo de referência é uma categoria do
  -- orçamento, não um conceito paralelo.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_custos_grupo_ref_ck'
  ) THEN
    ALTER TABLE modelagem_custos
      ADD CONSTRAINT modelagem_custos_grupo_ref_ck CHECK (grupo_referencia IS NULL OR grupo_referencia IN (
        'terreno', 'sitework', 'vertical', 'amenidades', 'offsite',
        'contingencia', 'soft', 'financeiro', 'outros'
      ));
  END IF;

  -- Percentual sem grupo de referência não tem base para incidir: seria um custo
  -- de zero e ninguém saberia por quê. A interface sempre preenche o grupo ao
  -- trocar a base para 'pct_de_grupo', então esta constraint é rede de segurança
  -- contra escrita fora do app, não validação de formulário.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_custos_pct_grupo_ck'
  ) THEN
    ALTER TABLE modelagem_custos
      ADD CONSTRAINT modelagem_custos_pct_grupo_ck
        CHECK (base_calculo <> 'pct_de_grupo' OR grupo_referencia IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN modelagem_custos.grupo_referencia IS
  'Categoria do orçamento sobre a qual o percentual incide. Obrigatório quando '
  'base_calculo = ''pct_de_grupo'', ignorado nas demais bases. A base inclui os '
  'custos daquela categoria MAIS o custo direto das tipologias quando a categoria '
  'tem contrapartida na unidade: ''terreno'' soma Σ(custo_terreno × quantidade) e '
  '''vertical'' soma Σ(custo_obra × quantidade). As demais categorias não têm '
  'coluna correspondente em modelagem_unidades e por isso somam só os custos. '
  'A definição canônica está em resolverCustos(), lib/modelagem/motor.ts.';

COMMENT ON COLUMN modelagem_custos.percentual IS
  'FRAÇÃO, não percentual: 0.050000 = 5%. Mesma convenção de '
  'modelagem_receita.comissao_pct e modelagem_socios.participacao_pct. Inerte '
  'quando base_calculo <> ''pct_de_grupo''. DEFAULT 0 para que toda linha anterior '
  'a esta migration continue produzindo o mesmo ModelOutput.';

-- Referência circular (um item que aponta para a própria categoria, ou dois que
-- apontam um para o outro) NÃO é impedida por constraint: um CHECK não enxerga
-- outras linhas, e mesmo que enxergasse, bloquear o INSERT violaria a invariante
-- do módulo — input inconsistente vira conferência, nunca exceção. O motor
-- detecta o ciclo, devolve 0 para os itens envolvidos e acende
-- `custo_referencia_circular` em vermelho, nomeando cada um deles.

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- modelagem_custos já nasceu com RLS habilitado e sem policy na 1760800000, e
-- não há tabela nova aqui. Reafirmado por ser idempotente e para que a migration
-- continue correta se for aplicada fora de ordem.
ALTER TABLE modelagem_custos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_custos FROM anon;
