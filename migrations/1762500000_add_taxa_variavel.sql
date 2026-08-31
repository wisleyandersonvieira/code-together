-- Modelagem Financeira — taxa variável: benchmark mais spread.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. A taxa efetiva de cada mês é DERIVADA pelo motor (benchmark + spread) e
-- nunca gravada; o que o banco guarda é a CURVA projetada do benchmark, que é
-- premissa do usuário.
--
-- Até aqui a taxa era um escalar fixo para o projeto inteiro. Um contrato
-- indexado tem benchmark + spread, e o benchmark muda mês a mês.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. O
-- DEFAULT 'fixa' mantém taxa_anual como a única fonte da taxa.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_financiamento
  ADD COLUMN IF NOT EXISTS tipo_taxa VARCHAR(10) NOT NULL DEFAULT 'fixa',
  ADD COLUMN IF NOT EXISTS spread DECIMAL(9,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS benchmark_nome VARCHAR(40),
  ADD COLUMN IF NOT EXISTS benchmark_padrao DECIMAL(9,6) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagem_financiamento_tipo_taxa_ck'
  ) THEN
    ALTER TABLE modelagem_financiamento
      ADD CONSTRAINT modelagem_financiamento_tipo_taxa_ck
        CHECK (tipo_taxa IN ('fixa', 'variavel'));
  END IF;
END $$;

COMMENT ON COLUMN modelagem_financiamento.tipo_taxa IS
  '''fixa'' (DEFAULT) = taxa_anual vale para o projeto inteiro, comportamento '
  'anterior a esta migration. ''variavel'' = a taxa do mês é '
  '(curva do benchmark naquele mês, ou benchmark_padrao) + spread, e taxa_anual '
  'deixa de ser lida.';

COMMENT ON COLUMN modelagem_financiamento.spread IS
  'FRAÇÃO ao ano somada ao benchmark: 0.035000 = 3,5% a.a. Mesma convenção de '
  'taxa_anual. Só é lido com tipo_taxa = ''variavel''.';

COMMENT ON COLUMN modelagem_financiamento.benchmark_padrao IS
  'Valor do benchmark, em FRAÇÃO ao ano, para os meses sem linha em '
  'modelagem_benchmark_curva. É o que impede um buraco na curva de virar juro '
  'zero em silêncio; a conferência benchmark_incompleto diz quantos meses caíram '
  'no padrão.';

-- ─── Curva do benchmark ──────────────────────────────────────────────────────
-- `mes` é ÍNDICE do cronograma (1..N), não data — mesma convenção de
-- modelagem_overrides.mes e modelagem_takedowns.mes. Guardar data aqui faria a
-- curva se deslocar sozinha toda vez que o início do projeto mudasse.
--
-- Mês sem linha NÃO é juro zero: cai em benchmark_padrao. Essa distinção é a
-- mesma de "valor 0 ≠ célula vazia" que vale para os overrides — uma linha com
-- valor 0 declara benchmark zero naquele mês; a AUSÊNCIA de linha declara
-- "não informado".
CREATE TABLE IF NOT EXISTS modelagem_benchmark_curva (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  financiamento_id INTEGER NOT NULL REFERENCES modelagem_financiamento(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  -- FRAÇÃO ao ano, como taxa_anual e spread.
  valor DECIMAL(9,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (financiamento_id, mes)
);

CREATE INDEX IF NOT EXISTS idx_modelagem_benchmark_curva_mod
  ON modelagem_benchmark_curva(modelagem_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da 1760800000: RLS ativo e NENHUMA policy, ou seja, negado por
-- padrão para anon e authenticated. O app chega por app_executor, que tem
-- BYPASSRLS. Sem este bloco, a tabela nova nasceria aberta no PostgREST.
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_benchmark_curva ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagem_financiamento, modelagem_benchmark_curva FROM anon;
