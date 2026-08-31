-- Modelagem Financeira — parcelamento do custo com gatilho 'mes_fixo'.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. Nada calculado é gravado — o fluxo de cada mês segue derivado pelo motor.
--
-- Até aqui, gatilho = 'mes_fixo' lançava 100% do custo no mês âncora. Numa pro
-- forma real quase nada vence assim: impact fee sai em 4 parcelas, o alvará em 2,
-- a taxa do banco em 3. A única saída era criar um custo por parcela — o que
-- multiplica linhas do orçamento que na verdade são um custo só, e faz o
-- subtotal da categoria contar a mesma despesa em pedaços sem nome.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. Nenhum
-- custo existente tem parcela, e ZERO parcelas é exatamente o comportamento de
-- hoje — o motor cai no ramo do mês âncora. O caminho novo é inalcançável para o
-- que já está gravado.
--
-- Idempotente: pode ser reaplicada.

-- ─── Parcelas do custo ───────────────────────────────────────────────────────
-- `mes` é ÍNDICE do cronograma (1..N), não data — mesma convenção de
-- modelagem_overrides.mes, modelagem_custos.mes_ancora, modelagem_takedowns.mes e
-- modelagem_aporte_parcelas.mes. A interface mostra a data derivada de
-- modelagens.data_inicio; o banco guarda o índice. Guardar data aqui faria o
-- parcelamento se deslocar sozinho toda vez que o início do projeto mudasse.
--
-- `modelagem_id` é redundante com custo_id → modelagem_custos.modelagem_id, e
-- está aqui de propósito: é por ele que o carregamento e a limpeza por modelagem
-- filtram sem precisar de JOIN, exatamente como em modelagem_unidade_fases.
CREATE TABLE IF NOT EXISTS modelagem_custo_parcelas (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  custo_id INTEGER NOT NULL REFERENCES modelagem_custos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE modelagem_custo_parcelas IS
  'Parcelas de um custo com gatilho ''mes_fixo''. Zero parcelas = comportamento '
  'anterior a esta migration: 100% no mes_ancora. Com parcelas, o mes_ancora é '
  'IGNORADO e são elas que lançam no fluxo. '
  'NÃO há UNIQUE (custo_id, mes) de propósito: duas parcelas no mesmo mês são '
  'legítimas e o motor simplesmente soma, como já acontece com modelagem_takedowns '
  'e com as parcelas de aporte. Um UNIQUE aqui transformaria um caso válido em '
  'erro de INSERT no meio da edição do usuário.';

COMMENT ON COLUMN modelagem_custo_parcelas.mes IS
  'ÍNDICE do cronograma (1..prazoTotal), não data. Parcela em mês acima do prazo '
  'atual NÃO é apagada: fica guardada, não é lançada, e a conferência '
  'custo_parcelas_fora_do_prazo acusa.';

COMMENT ON COLUMN modelagem_custo_parcelas.valor IS
  'Valor da parcela, editável. A soma das parcelas NÃO é imposta pelo valor '
  'efetivo do custo: quem lança no fluxo são as parcelas, e a diferença contra o '
  'alvo acende custo_parcelas_vs_alvo em âmbar em vez de ser corrigida sozinha.';

CREATE INDEX IF NOT EXISTS idx_modelagem_custo_parcelas_custo
  ON modelagem_custo_parcelas(custo_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_custo_parcelas_mod
  ON modelagem_custo_parcelas(modelagem_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da 1760800000: RLS ativo e NENHUMA policy, ou seja, negado por
-- padrão para anon e authenticated. O app chega por app_executor, que tem
-- BYPASSRLS. Sem este bloco, a tabela nova nasceria aberta no PostgREST.
ALTER TABLE modelagem_custo_parcelas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagem_custo_parcelas FROM anon;
