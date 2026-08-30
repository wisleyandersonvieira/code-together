-- Modelagem Financeira — quantidade por tipologia, plano de aportes e fases.
--
-- Continua valendo o que a migration 1760800000 estabeleceu: só INPUT e OVERRIDE
-- moram aqui. Nada de valor calculado. O fluxo, a apuração e as conferências
-- continuam saindo do motor puro em lib/modelagem/motor.ts.
--
-- Três mudanças, e todas têm o mesmo compromisso: modelagem já salva não pode
-- mudar de resultado depois desta migration. Por isso todo DEFAULT abaixo foi
-- escolhido para reproduzir exatamente o comportamento de hoje —
-- quantidade = 1, modo_aporte = 'demanda', usa_fases = FALSE.
--
--   1. modelagem_unidades vira uma lista de TIPOLOGIAS, com quantidade.
--   2. o aporte base sai da unidade e vira um plano por modelagem.
--   3. fases opcionais, com distribuição de unidades por fase.
--
-- Idempotente: pode ser reaplicada.

-- ─── 1. Quantidade na tipologia ──────────────────────────────────────────────
-- A linha de modelagem_unidades deixa de ser "uma unidade" e passa a ser "uma
-- tipologia com N unidades iguais". DEFAULT 1 é o que garante que toda
-- modelagem existente continua valendo exatamente o mesmo: N=1 reduz qualquer
-- multiplicação à identidade.
ALTER TABLE modelagem_unidades
  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1
    CHECK (quantidade >= 1);

COMMENT ON COLUMN modelagem_unidades.quantidade IS
  'Quantas unidades iguais esta tipologia representa. ATENÇÃO: os valores '
  'monetários e de área da linha (area_sf, custo_terreno, custo_obra, '
  'preco_venda, property_tax_ano) são POR UNIDADE. O total da tipologia é '
  'valor × quantidade — a multiplicação é feita no motor, nunca gravada.';

-- ─── 2. Plano de aportes ─────────────────────────────────────────────────────
-- Até aqui o "aporte base" era uma coluna por unidade, e o motor usava a SOMA
-- delas para dimensionar equityDisponivelObra no modo equity_first. Isso
-- misturava duas coisas distintas: um atributo da unidade e uma premissa de
-- capitalização do projeto inteiro. O plano de aportes separa as duas.
--
-- Uma linha por modelagem, no mesmo formato de modelagem_financiamento e
-- modelagem_receita.
CREATE TABLE IF NOT EXISTS modelagem_aportes (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL UNIQUE REFERENCES modelagens(id) ON DELETE CASCADE,
  modo_aporte VARCHAR(20) NOT NULL DEFAULT 'demanda'
    CHECK (modo_aporte IN ('demanda', 'plano')),
  -- Herdado da soma dos antigos modelagem_unidades.aporte_base. Só é usado quando
  -- modo_aporte = 'demanda', para dimensionar equityDisponivelObra no modo equity_first.
  aporte_base_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Alvo declarado pelo usuário. Não é imposto: se as parcelas não somarem isso,
  -- acende conferência âmbar. As parcelas é que valem.
  valor_total_alvo DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Parcelas do plano, uma por mês do cronograma.
--
-- `mes` é ÍNDICE do cronograma (1..N), não data — exatamente como
-- modelagem_overrides.mes, modelagem_custos.mes_ancora e
-- modelagem_vendas_unidade.mes_venda. A interface mostra a data derivada de
-- modelagens.data_inicio; o banco guarda o índice. Guardar data aqui faria o
-- plano se deslocar sozinho toda vez que o início do projeto mudasse.
CREATE TABLE IF NOT EXISTS modelagem_aporte_parcelas (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (modelagem_id, mes)
);

-- Seed para toda modelagem já existente, preservando o comportamento atual:
-- modo 'demanda' (o de hoje) e aporte_base_total igual à soma que o motor já
-- fazia sobre modelagem_unidades.aporte_base. Sem este INSERT, modelagens
-- antigas passariam a calcular com equityDisponivelObra = 0 e a curva de saque
-- do modo equity_first mudaria de forma silenciosa.
INSERT INTO modelagem_aportes (modelagem_id, modo_aporte, aporte_base_total, valor_total_alvo)
SELECT m.id, 'demanda',
       COALESCE((SELECT SUM(u.aporte_base) FROM modelagem_unidades u WHERE u.modelagem_id = m.id), 0),
       0
FROM modelagens m
ON CONFLICT (modelagem_id) DO NOTHING;

-- A coluna antiga fica. NÃO se descarta dado do usuário no mesmo deploy que muda
-- a semântica do campo: se o seed acima estiver errado para alguma modelagem, a
-- origem precisa continuar disponível para reconstruir. O DROP vai numa migration
-- futura, depois que o novo caminho estiver validado em produção.
COMMENT ON COLUMN modelagem_unidades.aporte_base IS
  'DEPRECADO desde a migration 1761000000. Substituído por '
  'modelagem_aportes.aporte_base_total (premissa do projeto, não da unidade). '
  'O app não lê nem escreve mais esta coluna; ela permanece apenas como origem '
  'do seed, para reconstrução. Remover em migration futura.';

-- ─── 3. Fases ────────────────────────────────────────────────────────────────
-- Fases são opcionais. usa_fases = FALSE reproduz o comportamento atual: uma
-- única frente, cronograma único, terreno inteiro no mês 1.
ALTER TABLE modelagens
  ADD COLUMN IF NOT EXISTS usa_fases BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS terreno_por_fase BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN modelagens.usa_fases IS
  'FALSE (default) = projeto de frente única, comportamento anterior à migration '
  '1761000000. TRUE = as unidades se distribuem entre modelagem_fases.';

COMMENT ON COLUMN modelagens.terreno_por_fase IS
  'Só tem efeito com usa_fases = TRUE. FALSE = o terreno inteiro é pago no mês 1 '
  '(comportamento atual). TRUE = o terreno é alocado por fase.';

CREATE TABLE IF NOT EXISTS modelagem_fases (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  nome VARCHAR(255) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT modelagem_fases_periodo_ck CHECK (data_fim >= data_inicio)
);

-- Quantas unidades de cada tipologia caem em cada fase.
--
-- Não há CHECK garantindo que a soma por unidade bata com
-- modelagem_unidades.quantidade: isso é conferência (âmbar), não constraint.
-- Input inconsistente nunca pode impedir o usuário de gravar e continuar
-- trabalhando — o motor sempre devolve resultado e o painel sinaliza.
CREATE TABLE IF NOT EXISTS modelagem_unidade_fases (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  unidade_id INTEGER NOT NULL REFERENCES modelagem_unidades(id) ON DELETE CASCADE,
  fase_id INTEGER NOT NULL REFERENCES modelagem_fases(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (unidade_id, fase_id)
);

-- ─── Índices ─────────────────────────────────────────────────────────────────
-- modelagem_aportes não entra: o UNIQUE em modelagem_id já cria o índice, mesmo
-- padrão de modelagem_financiamento e modelagem_receita.
CREATE INDEX IF NOT EXISTS idx_modelagem_aporte_parcelas_mod
  ON modelagem_aporte_parcelas(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_fases_mod ON modelagem_fases(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_unidade_fases_mod
  ON modelagem_unidade_fases(modelagem_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da 1760800000: RLS ativo e NENHUMA policy, ou seja, negado por
-- padrão para anon e authenticated. O app chega por app_executor, que tem
-- BYPASSRLS. Sem este bloco, as tabelas novas nasceriam abertas no PostgREST.
ALTER TABLE modelagem_aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_aporte_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_unidade_fases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagem_aportes, modelagem_aporte_parcelas,
  modelagem_fases, modelagem_unidade_fases FROM anon;
