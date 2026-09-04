-- Modelagem Financeira — o ATIVO LOCÁVEL na tipologia.
--
-- No modo locação a tipologia deixa de ser "casa a vender" e passa a ser "tipo
-- de espaço a locar". A tabela é a MESMA (`modelagem_unidades`) porque a
-- estrutura é a mesma — nome, área, custo de terreno, custo de obra, quantidade;
-- o que falta é o aluguel pedido.
--
-- ─── Por unidade, como todo o resto da linha ────────────────────────────────
-- Toda coluna monetária e de área desta tabela é POR UNIDADE, e o total da
-- tipologia é sempre `valor × quantidade` — multiplicação que o motor faz e o
-- banco nunca grava. `aluguel_sf_ano` segue a regra: é o aluguel anual por pé
-- quadrado de UMA unidade daquela tipologia.
--
-- Daí saem os dois derivados que o motor expõe em Agregados:
--   ablSf                = Σ (area_sf × quantidade)                  — a área bruta locável
--   receitaBrutaAnual100 = Σ (area_sf × aluguel_sf_ano × quantidade)  — a 100% de ocupação
--
-- ─── Simetria dos dois modos ────────────────────────────────────────────────
-- No modo locação `preco_venda` é IGNORADO — o valor de saída vem do cap rate —
-- e a coluna some da tela; se estiver preenchida, a conferência
-- `preco_venda_ignorado` acende âmbar para o usuário não achar que ela entra na
-- conta. No modo venda `aluguel_sf_ano` é ignorado e a coluna não aparece.
--
-- Nenhum dos dois é apagado quando o outro modo está ativo: input do usuário
-- fica guardado e inativo, nunca some em silêncio.
--
-- DEFAULT 0 e NOT NULL: toda tipologia já gravada nasce com aluguel zero, que é
-- inerte no modo venda — o único em que elas existem.
--
-- Idempotente: pode ser reaplicada.

ALTER TABLE modelagem_unidades
  ADD COLUMN IF NOT EXISTS aluguel_sf_ano DECIMAL(15,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN modelagem_unidades.aluguel_sf_ano IS
  'Aluguel pedido, por pe quadrado e por ano, de UMA unidade da tipologia — '
  'mesma convencao POR UNIDADE das demais colunas. So tem efeito com '
  'modelagens.tipo_modelagem = locacao; no modo venda fica guardado e inerte. '
  'A receita bruta anual a 100% de ocupacao e SUM(area_sf * aluguel_sf_ano * '
  'quantidade), calculada pelo motor e nunca persistida.';
