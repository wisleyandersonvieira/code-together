-- Modelagem Financeira — a modelagem MODELO.
--
-- Uma instalação tem uma modelagem que não é um projeto: é o plano de contas
-- padrão dos custos, pré-cadastrado, que serve de ponto de partida para as
-- demais. Ela é editável como qualquer outra — o usuário acrescenta e remove
-- linhas conforme a operação dele muda —, mas NÃO pode ser excluída: apagá-la
-- destruiria o plano de contas da instalação inteira, e recriá-lo à mão é o
-- tipo de trabalho que ninguém refaz.
--
-- A proteção mora AQUI, no banco, e não só no botão da tela: o `deleteModelagem`
-- é alcançável por qualquer caminho que chegue à action, e uma guarda que só
-- existe na interface não guarda nada.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagens
  ADD COLUMN IF NOT EXISTS is_modelo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN modelagens.is_modelo IS
  'Modelagem modelo: nasce com o plano de contas de custos pre-cadastrado e '
  'serve de ponto de partida para duplicacao. E editavel como qualquer outra — '
  'o usuario acrescenta e remove linhas de custo —, mas NAO pode ser excluida. '
  'No maximo uma por instalacao, garantido pelo indice parcial abaixo.';

-- NO MÁXIMO UMA MODELAGEM MODELO, e é isto que o índice abaixo diz.
--
-- A construção não é óbvia e merece a explicação: um índice UNIQUE precisa de
-- uma chave, e aqui a chave é a CONSTANTE `TRUE` — igual para toda linha
-- indexada. Como o `WHERE is_modelo` restringe o índice às linhas que têm a flag
-- ligada, todas elas disputam a mesma chave e a segunda é rejeitada. As linhas
-- com `is_modelo = FALSE` não entram no índice e não disputam nada.
--
-- O parêntese duplo é exigência de sintaxe: `((TRUE))` é uma expressão de
-- índice, e `(TRUE)` seria lido como nome de coluna.
CREATE UNIQUE INDEX IF NOT EXISTS idx_modelagens_modelo_unico
  ON modelagens ((TRUE)) WHERE is_modelo;
