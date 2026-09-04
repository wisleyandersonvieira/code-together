-- Modelagem Financeira — OPEX, ocupação e saída pelo cap rate.
--
-- As três tabelas do modo locação. Nenhuma delas é lida quando
-- `modelagens.tipo_modelagem = 'venda'`, que é o default e o estado de toda
-- modelagem já gravada — por construção, nada aqui pode mudar o resultado de uma
-- modelagem existente.
--
-- Idempotente: pode ser reaplicada.

-- ─── 3.1 Cabeçalho da locação ────────────────────────────────────────────────
--
-- 1:1 com a modelagem, como `modelagem_financiamento` e `modelagem_receita`. A
-- linha só existe em modelagem de locação; ausente, o mapeador devolve o padrão
-- neutro (tudo zerado, ocupação estabilizada 100%) em vez de `undefined` — o
-- motor não pode falhar por input incompleto.
CREATE TABLE IF NOT EXISTS modelagem_locacao (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL UNIQUE REFERENCES modelagens(id) ON DELETE CASCADE,
  -- Fracao do OPEX bruto que os inquilinos reembolsam (NNN). 0.85 = 85%.
  taxa_reembolso_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  -- Perda de credito sobre a receita EFETIVAMENTE FATURADA. Nao confundir com
  -- vacancia: a vacancia fisica ja esta na curva de ocupacao. Somar as duas
  -- conta o mesmo buraco duas vezes.
  perda_credito_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  -- Saida: valor = NOI de referencia / cap_rate_saida, menos custo_venda_pct.
  cap_rate_saida DECIMAL(9,6) NOT NULL DEFAULT 0,
  custo_venda_pct DECIMAL(9,6) NOT NULL DEFAULT 0,
  noi_referencia VARCHAR(16) NOT NULL DEFAULT 'estabilizado'
    CHECK (noi_referencia IN ('estabilizado', 'ultimos_12m')),
  -- Ocupacao considerada estabilizada. Alimenta o NOI de referencia quando
  -- noi_referencia = 'estabilizado' e o gerador da curva de ocupacao.
  ocupacao_estabilizada_pct DECIMAL(9,6) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN modelagem_locacao.noi_referencia IS
  'Qual NOI divide o cap rate para achar o valor de saida. '
  'O padrao de MERCADO e o NOI forward 12 meses a partir da saida — o comprador '
  'paga pelo que o ativo vai render, nao pelo que rendeu. Esse padrao NAO esta '
  'implementado porque exigiria modelar 12 meses ALEM do horizonte do projeto, '
  'com premissas de reajuste e renovacao que a modelagem nao tem. '
  'As duas opcoes implementadas ficam dentro do prazo ja modelado e sao '
  'auditaveis linha a linha: '
  'estabilizado (default) = receita a 100% x ocupacao estabilizada, menos o OPEX '
  'liquido de reembolso na mesma ocupacao — e o que a pro forma de referencia '
  'faz; ultimos_12m = soma do NOI dos 12 meses que terminam no mes de saida, o '
  'trailing do fluxo de fato modelado.';

COMMENT ON COLUMN modelagem_locacao.perda_credito_pct IS
  'Incide sobre a receita EFETIVAMENTE FATURADA, nao sobre a receita a 100% de '
  'ocupacao: inquilino que nao existe nao deixa de pagar. A vacancia fisica ja '
  'esta na curva de ocupacao (modelagem_ocupacao) — somar as duas contaria o '
  'mesmo buraco duas vezes.';

COMMENT ON COLUMN modelagem_locacao.cap_rate_saida IS
  'Cap rate exigido pelo comprador do ativo estabilizado. E o DIVISOR do valor '
  'de saida: zero devolve valor de saida ZERO, nunca Infinity, e a conferencia '
  'cap_rate_zerado acende vermelho.';

-- ─── 3.2 Linhas de OPEX ──────────────────────────────────────────────────────
--
-- Plano de contas da operação, como `modelagem_custos` é o do desenvolvimento.
-- Sem UNIQUE por label: duas linhas com o mesmo nome somam, e deduplicar
-- apagaria input do usuário em silêncio.
CREATE TABLE IF NOT EXISTS modelagem_opex (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  label VARCHAR(255) NOT NULL,
  valor_sf_ano DECIMAL(15,4) NOT NULL DEFAULT 0,
  -- Entra na base de reembolso NNN. Property taxes, seguro e manutencao entram;
  -- reserva de CapEx normalmente nao.
  reembolsavel BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN modelagem_opex.valor_sf_ano IS
  'Despesa anual por pe quadrado de ABL. O valor do mes e '
  'valor_sf_ano * ablSf / 12, e NAO varia com a ocupacao: predio vazio custa '
  'property tax, seguro e manutencao igual. O que varia com a ocupacao e o '
  'REEMBOLSO, porque so quem esta la paga.';

COMMENT ON COLUMN modelagem_opex.reembolsavel IS
  'Entra na base do reembolso NNN dos inquilinos. Property taxes, seguro e '
  'manutencao entram; reserva de reposicao (CapEx) normalmente NAO — e despesa '
  'do proprietario, nao do ocupante.';

-- ─── Property tax no modo locação ────────────────────────────────────────────
--
-- No modo locação o property tax vem de uma LINHA DE OPEX, e a coluna
-- `modelagem_unidades.property_tax_ano` é IGNORADA. Sem essa regra o imposto
-- sairia duas vezes — uma pelo caminho da tipologia (que o motor lança em
-- `property_tax` todo mês) e outra pela linha de OPEX.
--
-- A coluna da tipologia não é zerada nem apagada: fica guardada e inativa, e a
-- conferência `property_tax_duplicado` acende âmbar avisando que só a linha de
-- OPEX entra na conta.

-- ─── 3.3 Curva de ocupação ───────────────────────────────────────────────────
--
-- Mês SEM linha = ocupação ZERO. É o oposto da curva do benchmark, em que mês
-- ausente cai num padrão — e é deliberado: ocupação é um fato do lease-up, e
-- inventar um valor para o mês não declarado criaria receita que ninguém
-- projetou.
--
-- Aqui o UNIQUE faz sentido, ao contrário de parcelas, takedowns e aportes: duas
-- ocupações no mesmo mês não SOMAM (85% + 85% não é 170%), seriam
-- contraditórias. Somar seria a leitura errada; guardar as duas, ambíguo.
CREATE TABLE IF NOT EXISTS modelagem_ocupacao (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  ocupacao_pct DECIMAL(9,6) NOT NULL DEFAULT 0 CHECK (ocupacao_pct >= 0 AND ocupacao_pct <= 1),
  UNIQUE (modelagem_id, mes)
);

COMMENT ON TABLE modelagem_ocupacao IS
  'Curva de ocupacao fisica mes a mes, como FRACAO (0.85 = 85%). Mes sem linha '
  'e ocupacao ZERO, nao ocupacao padrao. O UNIQUE (modelagem_id, mes) existe '
  'porque duas ocupacoes no mesmo mes seriam contraditorias, e nao somariam — '
  'diferente de parcelas, takedowns e aportes, em que o duplicado soma.';

-- ─── 4.1 As duas linhas de fluxo novas ───────────────────────────────────────
--
-- `rental_revenue` e `opex` passam a aceitar override como qualquer outra linha.
-- O CHECK é recriado inteiro em vez de estendido: um CHECK do Postgres não se
-- "acrescenta", e reescrevê-lo por completo deixa a lista visível num lugar só.
--
-- Nenhum override existente é tocado: as nove chaves antigas continuam todas na
-- lista, com a mesma grafia.
ALTER TABLE modelagem_overrides
  DROP CONSTRAINT IF EXISTS modelagem_overrides_linha_check;

ALTER TABLE modelagem_overrides
  ADD CONSTRAINT modelagem_overrides_linha_check CHECK (linha IN (
    'land', 'construction', 'property_tax', 'other_costs', 'revenue',
    'draw', 'amortization', 'equity_call', 'distribution',
    'rental_revenue', 'opex'
  ));

-- ─── Índices ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_modelagem_opex_mod ON modelagem_opex(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_ocupacao_mod ON modelagem_ocupacao(modelagem_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da 1760800000: RLS ativo e NENHUMA policy, ou seja, negado por
-- padrão para anon e authenticated. O app chega por app_executor, que tem
-- BYPASSRLS. Sem este bloco, tabelas novas nasceriam abertas no PostgREST.
ALTER TABLE modelagem_locacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_opex ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelagem_ocupacao ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagem_locacao, modelagem_opex, modelagem_ocupacao FROM anon;
