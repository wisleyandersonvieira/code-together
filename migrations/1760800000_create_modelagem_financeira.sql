-- Módulo de Modelagem Financeira de Incorporação.
--
-- Só inputs e overrides moram aqui: NENHUM valor calculado é persistido. Fluxo de
-- caixa, apuração, indicadores e conferências saem do motor puro em
-- lib/modelagem/motor.ts a partir destas linhas.
--
-- Nomes em `modelagem_*` de propósito: já existe uma tabela `projetos` neste
-- schema com outro significado, e chamar isto de `projects` seria colisão
-- semântica garantida.
--
-- Idempotente: pode ser reaplicada.

-- ─── Cabeçalho da modelagem ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modelagens (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id) ON DELETE SET NULL,
  -- Vínculo opcional com um projeto já cadastrado. A modelagem existe sozinha.
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL,
  nome VARCHAR(255) NOT NULL,
  localizacao VARCHAR(255),
  tipo_uso VARCHAR(100),
  moeda CHAR(3) NOT NULL DEFAULT 'USD',
  -- Data do mês 1 do cronograma.
  data_inicio DATE NOT NULL,
  meses_aprovacao INTEGER NOT NULL DEFAULT 0 CHECK (meses_aprovacao >= 0),
  meses_construcao INTEGER NOT NULL DEFAULT 0 CHECK (meses_construcao >= 0),
  meses_pos_obra INTEGER NOT NULL DEFAULT 0 CHECK (meses_pos_obra >= 0),
  horizonte_maximo INTEGER NOT NULL DEFAULT 60 CHECK (horizonte_maximo > 0),
  data_base DATE,
  revisao VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Unidades ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modelagem_unidades (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  nome VARCHAR(255) NOT NULL,
  cidade VARCHAR(255),
  area_sf DECIMAL(15,2),
  custo_terreno DECIMAL(15,2) NOT NULL DEFAULT 0,
  custo_obra DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Premissa que dimensiona a curva do modo equity_first.
  -- NÃO é o aporte real: o aporte efetivo é calculado pelo motor (equity_call).
  aporte_base DECIMAL(15,2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(15,2) NOT NULL DEFAULT 0,
  property_tax_ano DECIMAL(15,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Custos que não pertencem a nenhuma unidade ──────────────────────────────
CREATE TABLE IF NOT EXISTS modelagem_custos (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  label VARCHAR(255) NOT NULL,
  valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  distribuicao VARCHAR(30) NOT NULL DEFAULT 'linear_construction'
    CHECK (distribuicao IN ('single_month', 'linear_total', 'linear_construction', 'manual')),
  -- Obrigatório quando distribuicao = 'single_month'; ignorado nos demais.
  mes_ancora INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT modelagem_custos_ancora_ck
    CHECK (distribuicao <> 'single_month' OR mes_ancora IS NOT NULL)
);

-- ─── Financiamento (uma linha por modelagem) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS modelagem_financiamento (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL UNIQUE REFERENCES modelagens(id) ON DELETE CASCADE,
  -- Fração ao ano: 0.0950 = 9,5% a.a.
  taxa_anual DECIMAL(9,6) NOT NULL DEFAULT 0,
  fee_estruturacao_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  fee_timing VARCHAR(20) NOT NULL DEFAULT 'first_draw'
    CHECK (fee_timing IN ('first_draw', 'contract_month')),
  fee_mes INTEGER,
  mes_inicio_saque INTEGER NOT NULL DEFAULT 1,
  mes_fim_saque INTEGER NOT NULL DEFAULT 1,
  modo_saque VARCHAR(20) NOT NULL DEFAULT 'equity_first'
    CHECK (modo_saque IN ('equity_first', 'cash_demand', 'manual')),
  -- Nulos os dois = sem teto de dívida. valor_contratado tem precedência.
  max_ltc_pct DECIMAL(9,6),
  valor_contratado DECIMAL(15,2),
  custo_financeiro_na_demanda BOOLEAN NOT NULL DEFAULT FALSE,
  modo_amortizacao VARCHAR(20) NOT NULL DEFAULT 'at_exit'
    CHECK (modo_amortizacao IN ('at_exit', 'manual')),
  capitalizar_juros BOOLEAN NOT NULL DEFAULT FALSE,
  colchao_minimo_caixa DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT modelagem_financiamento_fee_mes_ck
    CHECK (fee_timing <> 'contract_month' OR fee_mes IS NOT NULL)
);

-- ─── Sócios ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modelagem_socios (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  nome VARCHAR(255) NOT NULL,
  -- Fração, não percentual: 0.500000 = 50%.
  participacao_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  -- Cota ainda não colocada. Continua no rateio pro-rata; a flag é sinalização.
  cota_disponivel BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Receita (uma linha por modelagem) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS modelagem_receita (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL UNIQUE REFERENCES modelagens(id) ON DELETE CASCADE,
  comissao_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  custo_cartorio_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  modo_venda VARCHAR(20) NOT NULL DEFAULT 'single_exit'
    CHECK (modo_venda IN ('single_exit', 'per_unit', 'manual')),
  -- Nulo = usa o prazo total do cronograma.
  mes_saida INTEGER,
  lucro_investidores_pct DECIMAL(9,6) NOT NULL DEFAULT 0.8,
  lucro_sponsor_pct DECIMAL(9,6) NOT NULL DEFAULT 0.2,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Investidores + sponsor têm de somar 100% do lucro do projeto.
  CONSTRAINT modelagem_receita_split_ck
    CHECK (ABS(lucro_investidores_pct + lucro_sponsor_pct - 1) < 0.000001)
);

-- ─── Venda por unidade (usada quando modo_venda = 'per_unit') ────────────────
CREATE TABLE IF NOT EXISTS modelagem_vendas_unidade (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  unidade_id INTEGER NOT NULL REFERENCES modelagem_unidades(id) ON DELETE CASCADE,
  mes_venda INTEGER NOT NULL CHECK (mes_venda >= 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (modelagem_id, unidade_id)
);

-- ─── Cenários ────────────────────────────────────────────────────────────────
-- Toda modelagem nasce com um cenário is_baseline. Não existe override sem cenário.
CREATE TABLE IF NOT EXISTS modelagem_cenarios (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  input_snapshot JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Um único cenário base por modelagem.
CREATE UNIQUE INDEX IF NOT EXISTS idx_modelagem_cenario_baseline
  ON modelagem_cenarios (modelagem_id) WHERE is_baseline;

-- ─── Overrides ───────────────────────────────────────────────────────────────
-- O coração da edição manual.
--
-- `valor = 0` significa "forcei este mês a zero"; `limpar = TRUE` força a célula
-- a VAZIO. São coisas diferentes — sem essa distinção o princípio "vazio ≠ zero"
-- não é representável no banco.
--
-- Overrides em meses acima do prazo atual NÃO são apagados: o motor os devolve
-- como órfãos, a conferência acende âmbar e eles voltam a valer se o prazo
-- aumentar. Nunca faça delete silencioso de input do usuário.
CREATE TABLE IF NOT EXISTS modelagem_overrides (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  cenario_id INTEGER NOT NULL REFERENCES modelagem_cenarios(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  linha VARCHAR(20) NOT NULL CHECK (linha IN (
    'land', 'construction', 'property_tax', 'other_costs', 'revenue',
    'draw', 'amortization', 'equity_call', 'distribution'
  )),
  valor DECIMAL(18,6),
  limpar BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (modelagem_id, cenario_id, mes, linha),
  CONSTRAINT modelagem_overrides_valor_ck CHECK (limpar OR valor IS NOT NULL)
);

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_modelagens_empresa ON modelagens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_modelagens_projeto ON modelagens(projeto_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_unidades_mod ON modelagem_unidades(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_custos_mod ON modelagem_custos(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_socios_mod ON modelagem_socios(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_cenarios_mod ON modelagem_cenarios(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_overrides_cenario
  ON modelagem_overrides(modelagem_id, cenario_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da migration 1760200000: RLS ativo e NENHUMA policy, ou seja,
-- negado por padrão para anon e authenticated. O app chega por app_executor, que
-- tem BYPASSRLS. Sem este bloco, tabelas novas nasceriam abertas no PostgREST.
ALTER TABLE modelagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_financiamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_vendas_unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_cenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagens, modelagem_unidades, modelagem_custos,
  modelagem_financiamento, modelagem_socios, modelagem_receita,
  modelagem_vendas_unidade, modelagem_cenarios, modelagem_overrides FROM anon;
