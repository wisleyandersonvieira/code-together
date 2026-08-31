-- Modelagem Financeira — capital por sócio: valor e data próprios.
--
-- Continua valendo o que a 1760800000 estabeleceu: só INPUT e OVERRIDE moram
-- aqui. TIR, MOIC e ROI por sócio são DERIVADOS pelo motor e nunca gravados.
--
-- O problema: até aqui o capital era sempre pro-rata pela participação, e a
-- chamada de capital de um mês era repartida na mesma fração para todo mundo.
-- Numa sociedade real isso quase nunca é verdade — um sócio tem 30% da
-- sociedade e põe 40% do dinheiro, outro entra seis meses depois. Com o rateio
-- pro-rata, MOIC, ROI e TIR saíam IDÊNTICOS para todos os sócios, o que só é
-- verdade quando todos põem a mesma fração nas mesmas datas.
--
-- Duas grandezas que este módulo passa a distinguir, e que não devem ser
-- confundidas nunca mais:
--   participacao_pct governa o LUCRO;
--   regra_rateio_capital + pct_capital + modelagem_socio_aportes governam o CAPITAL.
--
-- Compromisso de sempre: modelagem já salva não pode mudar de resultado. O
-- default 'participacao' é exatamente o rateio de hoje, `pct_capital` nasce NULL
-- (= usa a participação) e nenhuma modelagem existente ganha linha em
-- modelagem_socio_aportes. Os dois caminhos novos são inalcançáveis para o que
-- já está gravado.
--
-- Idempotente: pode ser reaplicada.

-- ─── Regra de repartição do CAPITAL ──────────────────────────────────────────
-- Não confundir com participacao_pct, que continua governando o LUCRO. Um sócio
-- pode ter 30% da sociedade e ter posto 40% do dinheiro — é o caso das
-- negociações individuais.
ALTER TABLE modelagem_aportes
  ADD COLUMN IF NOT EXISTS regra_rateio_capital VARCHAR(20) NOT NULL DEFAULT 'participacao'
    CHECK (regra_rateio_capital IN ('participacao', 'pct_capital', 'cronograma_socio'));

COMMENT ON COLUMN modelagem_aportes.regra_rateio_capital IS
  'Como o capital chamado se reparte entre os sócios. '
  '''participacao'' (default) = pela participacao_pct, o comportamento anterior a '
  'esta migration. ''pct_capital'' = pela fração própria de cada sócio '
  '(modelagem_socios.pct_capital). ''cronograma_socio'' = cada sócio tem seus '
  'próprios valores e meses (modelagem_socio_aportes), e o equity_call do mês '
  'passa a ser a SOMA dos aportes daquele mês.';

-- ─── Fração de capital por sócio ─────────────────────────────────────────────
-- Só vale com regra_rateio_capital = 'pct_capital'. NULL é diferente de zero, e
-- a distinção é a de sempre neste módulo: NULL = "usa participacao_pct", que é o
-- comportamento de hoje; 0 = "este sócio não põe capital nenhum".
ALTER TABLE modelagem_socios
  ADD COLUMN IF NOT EXISTS pct_capital DECIMAL(9,6);

COMMENT ON COLUMN modelagem_socios.pct_capital IS
  'FRAÇÃO do capital chamado (0.4 = 40%), não percentual. Só vale com '
  'modelagem_aportes.regra_rateio_capital = ''pct_capital''. NULL = usa '
  'participacao_pct — que é o comportamento anterior a esta migration e o de '
  'toda linha já gravada. ZERO tem significado próprio: sócio que não aporta.';

-- ─── Cronograma de aporte por sócio ──────────────────────────────────────────
-- `mes` é ÍNDICE do cronograma (1..N), não data — mesma convenção de
-- modelagem_overrides.mes, modelagem_takedowns.mes, modelagem_custo_parcelas.mes
-- e modelagem_aporte_parcelas.mes. A interface mostra a data derivada de
-- modelagens.data_inicio; o banco guarda o índice. Guardar data aqui faria o
-- cronograma de capital se deslocar sozinho toda vez que o início do projeto
-- mudasse.
CREATE TABLE IF NOT EXISTS modelagem_socio_aportes (
  id SERIAL PRIMARY KEY,
  modelagem_id INTEGER NOT NULL REFERENCES modelagens(id) ON DELETE CASCADE,
  socio_id INTEGER NOT NULL REFERENCES modelagem_socios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  mes INTEGER NOT NULL CHECK (mes >= 1),
  valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE modelagem_socio_aportes IS
  'Aportes de capital de um sócio, com valor e mês próprios. Só têm efeito com '
  'modelagem_aportes.regra_rateio_capital = ''cronograma_socio''; nas demais '
  'regras ficam guardados e inativos. '
  'NÃO há UNIQUE (socio_id, mes) de propósito: dois aportes do mesmo sócio no '
  'mesmo mês são legítimos e o motor simplesmente soma, como já acontece com '
  'modelagem_takedowns e modelagem_custo_parcelas. Um UNIQUE aqui transformaria '
  'um caso válido em erro de INSERT no meio da edição do usuário.';

COMMENT ON COLUMN modelagem_socio_aportes.mes IS
  'ÍNDICE do cronograma (1..prazoTotal), não data. Aporte em mês acima do prazo '
  'atual NÃO é apagado: fica guardado, não é lançado, e a conferência '
  'aportes_socio_fora_do_prazo acusa.';

CREATE INDEX IF NOT EXISTS idx_modelagem_socio_aportes_socio
  ON modelagem_socio_aportes(socio_id);
CREATE INDEX IF NOT EXISTS idx_modelagem_socio_aportes_mod
  ON modelagem_socio_aportes(modelagem_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Mesmo padrão da 1760800000: RLS ativo e NENHUMA policy, ou seja, negado por
-- padrão para anon e authenticated. O app chega por app_executor, que tem
-- BYPASSRLS. Sem este bloco, a tabela nova nasceria aberta no PostgREST.
ALTER TABLE modelagem_socio_aportes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON modelagem_socio_aportes FROM anon;
