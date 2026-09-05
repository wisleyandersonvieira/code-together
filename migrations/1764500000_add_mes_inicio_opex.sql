-- Modelagem Financeira — a JANELA DE OPERAÇÃO do modo locação.
--
-- Antes desta coluna o bloco de locação do motor percorria o prazo inteiro sem
-- guarda nenhuma: o OPEX era lançado desde o mês 1, quando ainda não há prédio
-- para pagar property tax, seguro nem administração predial, e o aluguel e o
-- OPEX continuavam depois do mês de saída, quando o ativo já foi vendido.
--
-- Nulável e SEM UPDATE de dado. Nulo significa "derivado do cronograma", então
-- toda modelagem de locação já gravada passa a calcular certo sozinha, sem
-- ninguém preencher nada — o mesmo raciocínio que fez `linha_rotativa` nascer
-- com default: o comportamento correto sem intervenção.
--
-- Nenhuma modelagem de VENDA é tocada: a tabela inteira só é lida quando
-- `modelagens.tipo_modelagem = 'locacao'`.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_locacao
  ADD COLUMN IF NOT EXISTS mes_inicio_opex INTEGER;

COMMENT ON COLUMN modelagem_locacao.mes_inicio_opex IS
  'Primeiro mes em que o ativo opera: quando comecam o OPEX e o aluguel.
   NULL = derivado do cronograma, mes de fim da obra + 1. Antes desta coluna o
   OPEX era lancado desde o mes 1, quando ainda nao ha predio para pagar
   property tax, seguro nem administracao predial.
   O FIM da janela nao e configuravel: e o mes de saida, porque depois da venda
   o ativo nao e mais do projeto.';
