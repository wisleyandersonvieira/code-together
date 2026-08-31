-- Modelagem Financeira — gatilho de vencimento do custo.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. O mês em que cada custo cai é DERIVADO pelo motor a partir do gatilho e
-- do cronograma, e nunca gravado — guardar o índice do mês faria o custo se
-- deslocar sozinho toda vez que o cronograma mudasse, o mesmo motivo pelo qual
-- modelagem_fases guarda datas e não índices.
--
-- Impact fees, water/sewer fees e alvarás são valores por unidade com um momento
-- de vencimento próprio: na emissão do alvará, no fechamento de cada unidade, ou
-- em mês fixo. Até aqui entravam como custo plano e perdiam essa informação.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Por
-- isso o DEFAULT é 'cronograma', que reproduz exatamente a distribuição atual —
-- o custo continua saindo de `distribuicao`/`mes_ancora`, sem desvio nenhum.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS gatilho VARCHAR(24) NOT NULL DEFAULT 'cronograma';

-- CHECK à parte do ADD COLUMN, pelo mesmo motivo da 1761200000: com
-- IF NOT EXISTS, reaplicar numa base que já tem a coluna pularia a constraint
-- embutida.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_custos_gatilho_ck'
  ) THEN
    ALTER TABLE modelagem_custos
      ADD CONSTRAINT modelagem_custos_gatilho_ck CHECK (gatilho IN (
        'cronograma', 'inicio_obra', 'fim_obra', 'por_venda', 'mes_fixo'
      ));
  END IF;
END $$;

COMMENT ON COLUMN modelagem_custos.gatilho IS
  'Quando o custo vence. ''cronograma'' (DEFAULT) reproduz a distribuição atual e '
  'é o valor que preserva o comportamento de toda modelagem anterior a esta '
  'migration: o lançamento continua saindo de `distribuicao` e `mes_ancora`. '
  'Nos demais o gatilho SUBSTITUI a distribuição — ''inicio_obra'' e ''fim_obra'' '
  'lançam 100% no mês correspondente do cronograma, ''mes_fixo'' lança 100% em '
  '`mes_ancora`, e ''por_venda'' rateia o valor pelas unidades vendidas em cada '
  'mês, para impact fee e afins que vencem no fechamento da unidade.';

-- `mes_ancora` NÃO ganha constraint de obrigatoriedade para o gatilho
-- 'mes_fixo', ao contrário do que a 1760800000 fez para distribuicao =
-- 'single_month'. A escolha é deliberada: recusar o INSERT transformaria um
-- formulário meio preenchido em erro de banco, e a invariante do módulo é que
-- input inconsistente vira CONFERÊNCIA, nunca exceção. Gatilho 'mes_fixo' sem
-- mês âncora simplesmente não lança nada, e `custo_gatilho_nao_lancado` acende
-- âmbar dizendo quanto dinheiro ficou de fora do fluxo.

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- modelagem_custos já nasceu com RLS habilitado e sem policy na 1760800000, e
-- não há tabela nova aqui. Reafirmado por ser idempotente e para que a migration
-- continue correta se for aplicada fora de ordem.
ALTER TABLE modelagem_custos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_custos FROM anon;
