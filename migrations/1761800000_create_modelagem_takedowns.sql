-- Modelagem Financeira — takedown schedule.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. A receita de cada mês é DERIVADA pelo motor a partir dos takedowns e
-- nunca gravada.
--
-- Numa pro forma real a receita não é "venda única no mês de saída": são
-- takedowns mensais de 3-4 unidades, cada um com mês, quantidade e preço. Até
-- aqui o único caminho escalonado era modo_venda = 'per_unit', que exige uma
-- linha por TIPOLOGIA em modelagem_vendas_unidade e faz a tipologia inteira
-- vender de uma vez — com 45 casas iguais, ou são 45 tipologias de 1 unidade, ou
-- não há como escalonar.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Por
-- isso 'takedown' é um modo NOVO: nenhuma linha existente tem modo_venda =
-- 'takedown', então o caminho novo é inalcançável para o que já está gravado.
-- 'single_exit', 'per_unit' e 'manual' seguem exatamente como estavam.
--
-- Idempotente: pode ser reaplicada.

-- ─── Takedowns ───────────────────────────────────────────────────────────────
-- `mes` é ÍNDICE do cronograma (1..N), não data — mesma convenção de
-- modelagem_overrides.mes, modelagem_custos.mes_ancora e
-- modelagem_vendas_unidade.mes_venda. A interface mostra a data derivada de
-- modelagens.data_inicio; o banco guarda o índice. Guardar data aqui faria o
-- cronograma de vendas se deslocar sozinho toda vez que o início do projeto
-- mudasse.
CREATE TABLE IF NOT EXISTS modelagem_takedowns (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  -- A TIPOLOGIA de onde saem as unidades deste lote.
  unidade_id INTEGER NOT NULL REFERENCES modelagem_unidades(id) ON DELETE CASCADE,
  -- Fase de origem, opcional. ON DELETE SET NULL e não CASCADE: apagar a fase
  -- não pode apagar em silêncio o cronograma de vendas que o usuário montou —
  -- o takedown perde o vínculo e continua vendendo.
  fase_id INTEGER REFERENCES modelagem_fases(id) ON DELETE SET NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
  preco_unitario DECIMAL(15,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NÃO há UNIQUE (unidade_id, mes): dois lotes da mesma tipologia no mesmo mês
-- são legítimos (preços diferentes, fases diferentes) e o motor simplesmente
-- soma. Um UNIQUE aqui recusaria input válido.

COMMENT ON COLUMN modelagem_takedowns.preco_unitario IS
  'Preço de venda POR UNIDADE deste lote. ZERO tem significado próprio: '
  '"usar o preço da tipologia" (modelagem_unidades.preco_venda), que é o caso '
  'comum e o default. Um lote realmente vendido a zero não existe, então não há '
  'ambiguidade — mas repare que isto NÃO contraria "valor 0 ≠ célula vazia": o '
  'zero aqui é um valor com semântica declarada, não a ausência de um valor.';

COMMENT ON COLUMN modelagem_takedowns.mes IS
  'ÍNDICE do cronograma (1..prazoTotal), não data. A data é derivada de '
  'modelagens.data_inicio pela interface. Takedown em mês acima do prazo atual '
  'NÃO é apagado: fica guardado, não é lançado, e a conferência acusa.';

COMMENT ON COLUMN modelagem_takedowns.fase_id IS
  'Fase de origem do lote, opcional. Serve à conferência takedown_antes_da_fase, '
  'que acende âmbar quando o lote vende antes de a fase concluir — é possível '
  '(venda na planta), mas o usuário tem de enxergar.';

CREATE INDEX IF NOT EXISTS idx_modelagem_takedowns_mod
  ON modelagem_takedowns(modelagem_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_takedowns_unidade
  ON modelagem_takedowns(unidade_id);

-- ─── 'takedown' entra no CHECK de modo_venda ─────────────────────────────────
-- modelagem_vendas_unidade NÃO é tocada e 'per_unit' continua funcionando: a
-- migração de dado de um modo para o outro acontece quando o usuário escolher o
-- modo novo, na interface, e não aqui. Migration não decide por usuário.
--
-- O CHECK da 1760800000 é inline e sem nome, então o Postgres o batizou de
-- modelagem_receita_modo_venda_check. Os dois DROP IF EXISTS cobrem o nome
-- automático e o nome novo, o que torna a migration reaplicável.
ALTER TABLE modelagem_receita
  DROP CONSTRAINT IF EXISTS modelagem_receita_modo_venda_check;
ALTER TABLE modelagem_receita
  DROP CONSTRAINT IF EXISTS modelagem_receita_modo_venda_ck;
ALTER TABLE modelagem_receita
  ADD CONSTRAINT modelagem_receita_modo_venda_ck
    CHECK (modo_venda IN ('single_exit', 'per_unit', 'manual', 'takedown'));

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da 1760800000: RLS ativo e NENHUMA policy, ou seja, negado por
-- padrão para anon e authenticated. O app chega por app_executor, que tem
-- BYPASSRLS. Sem este bloco, a tabela nova nasceria aberta no PostgREST.
ALTER TABLE modelagem_takedowns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagem_takedowns FROM anon;
