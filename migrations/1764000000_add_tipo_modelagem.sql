-- Modelagem Financeira — o SWITCH entre os dois modos de negócio.
--
-- Até aqui o módulo modelava uma coisa só: incorporação para VENDA das unidades.
-- Esta coluna abre o segundo modo — desenvolver, LOCAR e vender o ativo
-- estabilizado a um fundo pelo cap rate.
--
-- ─── Por que o DEFAULT é 'venda', e por que ele é a peça central ─────────────
-- Toda modelagem já gravada nasce em 'venda' sem UPDATE nenhum, e todo caminho
-- novo do motor fica atrás de `tipo_modelagem = 'locacao'`. É isso — e só isso —
-- que garante que nenhuma modelagem existente mude de resultado: os campos
-- novos são inalcançáveis para ela.
--
-- ─── Por que o tipo NÃO pode ser alterado depois de criada ──────────────────
-- Os dois modos têm campos próprios que o outro ignora: `preco_venda` e os
-- takedowns só valem na venda; `aluguel_sf_ano`, o OPEX e a curva de ocupação só
-- valem na locação. Trocar o tipo de uma modelagem já preenchida deixaria campos
-- órfãos de um modo dentro do outro — dados que o motor não lê, a tela não
-- mostra e ninguém consegue auditar depois.
--
-- A regra é aplicada na INTERFACE (o campo fica somente leitura no editor, com
-- selo do tipo no cabeçalho, e a orientação é duplicar). Não há trigger de
-- imutabilidade aqui de propósito: uma correção administrativa legítima — uma
-- modelagem criada no tipo errado e ainda vazia — precisa ser possível por SQL
-- sem derrubar uma constraint.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagens
  ADD COLUMN IF NOT EXISTS tipo_modelagem VARCHAR(10) NOT NULL DEFAULT 'venda';

-- O CHECK vai em statement separado e guardado: `ADD COLUMN IF NOT EXISTS` não
-- recria a coluna numa reaplicação, mas `ADD CONSTRAINT` sem guarda estouraria.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modelagens_tipo_modelagem_ck'
  ) THEN
    ALTER TABLE modelagens
      ADD CONSTRAINT modelagens_tipo_modelagem_ck
      CHECK (tipo_modelagem IN ('venda', 'locacao'));
  END IF;
END $$;

COMMENT ON COLUMN modelagens.tipo_modelagem IS
  'venda (default, comportamento anterior) = incorporacao para venda das '
  'unidades. locacao = desenvolver, locar e vender o ativo estabilizado pelo '
  'cap rate. O default garante que toda modelagem existente continua no modo '
  'venda e nao muda de resultado.';

-- A lista filtra por tipo, e o editor decide as abas por ele: sem índice, todo
-- filtro vira sequential scan sobre a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_modelagens_tipo ON modelagens(tipo_modelagem);
