-- Modelagem Financeira — orçamento hierárquico por categoria.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. Nada de valor calculado. Os subtotais por categoria são AGREGADOS DE
-- SAÍDA, computados pelo motor puro em lib/modelagem/motor.ts a cada cálculo —
-- nenhum deles é gravado.
--
-- Até aqui modelagem_custos era uma lista plana. Uma pro forma real tem o
-- orçamento em árvore — Hard Costs › Horizontal › Onsite › Land / Sitework /
-- Amenities / Offsite, depois Vertical Construction, Contingency, Soft Costs e
-- Financing Costs — e cada nível totaliza sozinho. Sem esses subtotais não
-- existe "total de hard costs", que é a base de outras contas.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Por
-- isso o DEFAULT é 'outros' e grupo_pai nasce NULL — categoria é agrupamento de
-- SAÍDA, não regra de lançamento, então a distribuição no tempo de todo custo
-- existente permanece byte a byte a mesma.
--
-- Idempotente: pode ser reaplicada.

-- ─── Categoria ───────────────────────────────────────────────────────────────
ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(40) NOT NULL DEFAULT 'outros';

-- CHECK à parte do ADD COLUMN: com IF NOT EXISTS, reaplicar a migration numa
-- base que já tem a coluna pularia a constraint embutida. Aqui ela é criada
-- sempre que faltar, e nunca duas vezes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_custos_categoria_ck'
  ) THEN
    ALTER TABLE modelagem_custos
      ADD CONSTRAINT modelagem_custos_categoria_ck CHECK (categoria IN (
        'terreno', 'sitework', 'vertical', 'amenidades', 'offsite',
        'contingencia', 'soft', 'financeiro', 'outros'
      ));
  END IF;
END $$;

COMMENT ON COLUMN modelagem_custos.categoria IS
  'Agrupa a linha para os SUBTOTAIS do orçamento (agregados.custosPorCategoria). '
  'É agrupamento de SAÍDA, não regra de lançamento: a distribuição no tempo '
  'continua saindo exclusivamente de `distribuicao` e `mes_ancora`, e trocar a '
  'categoria de uma linha NÃO muda um único mês do fluxo de caixa. '
  'DEFAULT ''outros'' para que toda modelagem anterior a esta migration continue '
  'produzindo exatamente o mesmo ModelOutput.';

-- ─── Hierarquia visual ───────────────────────────────────────────────────────
-- Segundo nível dentro da categoria: uma linha de custo pode pendurar-se em
-- outra (ex.: "Mobilização" sob "Sitework"). ON DELETE SET NULL, e não CASCADE:
-- apagar o grupo pai NÃO pode apagar em silêncio o custo que o usuário lançou
-- no filho — a linha sobe para a raiz da categoria e continua no fluxo.
ALTER TABLE modelagem_custos
  ADD COLUMN IF NOT EXISTS grupo_pai INTEGER
    REFERENCES modelagem_custos(id) ON DELETE SET NULL;

COMMENT ON COLUMN modelagem_custos.grupo_pai IS
  'Hierarquia VISUAL dentro da categoria: aponta para a linha de modelagem_custos '
  'que agrupa esta. NULL = linha de primeiro nível. Não tem efeito nenhum sobre o '
  'cálculo — o motor soma todas as linhas da categoria uma única vez, '
  'independentemente do aninhamento, e por isso pai e filho nunca são somados em '
  'duplicidade. ON DELETE SET NULL preserva o custo do filho quando o pai é '
  'removido.';

CREATE INDEX IF NOT EXISTS idx_modelagem_custos_grupo_pai
  ON modelagem_custos(grupo_pai) WHERE grupo_pai IS NOT NULL;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- modelagem_custos já nasceu com RLS habilitado e sem policy na 1760800000, e
-- não há tabela nova aqui. O bloco é reafirmado por ser idempotente e para que
-- a migration continue correta se for aplicada fora de ordem.
ALTER TABLE modelagem_custos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON modelagem_custos FROM anon;
