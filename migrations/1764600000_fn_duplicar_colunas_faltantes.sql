-- Modelagem Financeira — duas colunas que a duplicação perdia em silêncio.
--
-- A função da 1764400000 estava com a lista de colunas DEFASADA em duas
-- tabelas. Nenhuma das duas dava erro: as colunas ficavam com o DEFAULT, e a
-- cópia nascia com número errado em vez de nascer quebrada.
--
--   modelagem_unidades.aluguel_sf_ano  (migration 1764050000)
--     DEFAULT 0. É o aluguel pedido por pé quadrado ao ano — a receita INTEIRA
--     do modo locação sai de Σ (area_sf × aluguel_sf_ano × quantidade).
--     Duplicar uma locação produzia uma cópia com receita bruta zero, NOI
--     negativo e valor de saída zero.
--
--   modelagem_locacao.mes_inicio_opex  (migration 1764500000)
--     Nulável, e NULL significa "derivado do cronograma" — não "não informado".
--     A cópia perdia o mês declarado e voltava a derivar.
--
-- ─── Por que isto virou teste na mesma leva ─────────────────────────────────
--
-- `aluguel_sf_ano` é ANTERIOR à 1764400000: a lista de colunas já nasceu
-- incompleta, no dia em que foi escrita e conferida. `mes_inicio_opex` entrou
-- uma migration depois. Ou seja, a conferência manual falhou nos dois sentidos
-- possíveis — no passado e no futuro.
--
-- Por isso a correção vem acompanhada de `migrations/colunas-funcoes.test.ts`,
-- que compara a lista de colunas de cada tabela contra as colunas citadas na
-- função e reprova quando o banco tem uma que a função ignora. A próxima coluna
-- é descoberta no CI, não seis meses depois num fluxo de caixa que não bate.
--
-- O restante do corpo é o da 1764400000, sem alteração. Idempotente:
-- CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION duplicar_modelagem(p_origem INT, p_nome TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_novo     INT;
  v_id       INT;
  r          RECORD;
BEGIN
  -- ── 1. Cabeçalho ──────────────────────────────────────────────────────────
  -- `is_modelo` é sempre FALSE na cópia: o modelo é único (índice parcial da
  -- migration 1763500000) e duplicá-lo produz uma modelagem de verdade.
  -- `status` volta a 'rascunho' — a cópia não herda a aprovação da original.
  -- `empresa_id` e `projeto_id` FICAM: duplicar para testar outro cenário do
  -- mesmo projeto é o caso de uso mais comum, e perder o vínculo seria atrito.
  INSERT INTO modelagens (
    empresa_id, projeto_id, nome, localizacao, tipo_uso, moeda, data_inicio,
    meses_aprovacao, meses_construcao, meses_pos_obra, horizonte_maximo,
    data_base, revisao, status, usa_fases, terreno_por_fase, is_modelo,
    tipo_modelagem
  )
  SELECT
    empresa_id, projeto_id, COALESCE(NULLIF(p_nome, ''), nome || ' (cópia)'),
    localizacao, tipo_uso, moeda, data_inicio,
    meses_aprovacao, meses_construcao, meses_pos_obra, horizonte_maximo,
    data_base, revisao, 'rascunho', usa_fases, terreno_por_fase, FALSE,
    -- O TIPO acompanha a cópia, e não podia ser diferente: duplicar é o caminho
    -- que a interface oferece para quem quer o outro modo — mas trocando o tipo
    -- na tela de criação, com os campos zerados, e nunca aqui. Uma cópia que
    -- mudasse de modo sozinha teria aluguel sem OPEX, ou OPEX sem aluguel.
    tipo_modelagem
  FROM modelagens WHERE id = p_origem
  RETURNING id INTO v_novo;

  -- Origem inexistente devolve zero linhas e v_novo fica NULL. Falhar aqui é o
  -- certo: seguir criaria filhos órfãos de uma modelagem que não existe.
  IF v_novo IS NULL THEN
    RAISE EXCEPTION 'duplicar_modelagem: modelagem % não existe', p_origem;
  END IF;

  -- Mapas (antigo → novo). ON COMMIT DROP amarra o tempo de vida à transação;
  -- IF NOT EXISTS + DELETE cobre duas chamadas na MESMA transação, em que a
  -- tabela sobrevive da primeira para a segunda.
  CREATE TEMP TABLE IF NOT EXISTS _dup_mapa (
    tabela    TEXT NOT NULL,
    id_antigo INT  NOT NULL,
    id_novo   INT  NOT NULL,
    PRIMARY KEY (tabela, id_antigo)
  ) ON COMMIT DROP;
  DELETE FROM _dup_mapa;

  -- ── 2. Cenários ───────────────────────────────────────────────────────────
  -- Todos, inclusive os não-baseline: são trabalho do usuário, e descartá-los na
  -- duplicação seria perda silenciosa.
  FOR r IN SELECT * FROM modelagem_cenarios WHERE modelagem_id = p_origem ORDER BY id LOOP
    INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline, input_snapshot)
    VALUES (v_novo, r.nome, r.is_baseline, r.input_snapshot)
    RETURNING id INTO v_id;
    INSERT INTO _dup_mapa VALUES ('cenario', r.id, v_id);
  END LOOP;

  -- Rede de segurança: uma modelagem sem cenário baseline não ancora override
  -- nenhum, e a cópia nasceria quebrada junto com a origem. Custa uma linha.
  IF NOT EXISTS (SELECT 1 FROM modelagem_cenarios WHERE modelagem_id = v_novo AND is_baseline) THEN
    INSERT INTO modelagem_cenarios (modelagem_id, nome, is_baseline)
    VALUES (v_novo, 'Base', TRUE);
  END IF;

  -- ── 3. Facilidades de crédito → mapa (1:N desde a 1764200000) ─────────────
  --
  -- Deixou de ser 1:1, e com isso deixou de caber num `INSERT ... RETURNING
  -- INTO`: com duas facilidades aquilo estoura com "query returned more than one
  -- row". Vira laço com mapa, como unidades, fases, custos e sócios.
  --
  -- ─── A SEGUNDA ARMADILHA AUTO-REFERENCIAL DESTA FUNÇÃO ───────────────────
  -- `refinancia_facilidade_id` referencia a PRÓPRIA tabela, exatamente como
  -- `modelagem_custos.grupo_pai`. Copiar o valor direto não dá erro nenhum — a
  -- FK é válida, a linha existe —, mas o permanent loan da CÓPIA ficaria
  -- refinanciando o construction loan da ORIGINAL. As duas modelagens ficariam
  -- amarradas, e o defeito só apareceria quando alguém mexesse na original e a
  -- cópia mudasse de dívida sozinha.
  --
  -- Por isso as facilidades entram com `refinancia_facilidade_id = NULL` e um
  -- UPDATE separado remapeia pelo mapa. Qualquer FK auto-referencial que apareça
  -- no futuro pede o mesmo cuidado.
  FOR r IN SELECT * FROM modelagem_financiamento WHERE modelagem_id = p_origem
           ORDER BY ordem, id LOOP
    INSERT INTO modelagem_financiamento (
      modelagem_id, ordem, nome, ativo, refinancia_facilidade_id,
      taxa_anual, fee_estruturacao_pct, fee_timing, fee_mes,
      mes_inicio_saque, mes_fim_saque, modo_saque, max_ltc_pct, valor_contratado,
      custo_financeiro_na_demanda, modo_amortizacao, capitalizar_juros,
      colchao_minimo_caixa, reserva_juros, reserva_juros_sacada, prazo_meses,
      carencia_meses, amortizacao_meses, balloon_no_vencimento, release_price,
      release_price_pct, convencao_juros, tipo_taxa, spread, benchmark_nome,
      benchmark_padrao, linha_rotativa
    )
    VALUES (
      v_novo, r.ordem, r.nome, r.ativo, NULL,
      r.taxa_anual, r.fee_estruturacao_pct, r.fee_timing, r.fee_mes,
      r.mes_inicio_saque, r.mes_fim_saque, r.modo_saque, r.max_ltc_pct, r.valor_contratado,
      r.custo_financeiro_na_demanda, r.modo_amortizacao, r.capitalizar_juros,
      r.colchao_minimo_caixa, r.reserva_juros, r.reserva_juros_sacada, r.prazo_meses,
      r.carencia_meses, r.amortizacao_meses, r.balloon_no_vencimento, r.release_price,
      r.release_price_pct, r.convencao_juros, r.tipo_taxa, r.spread, r.benchmark_nome,
      r.benchmark_padrao, r.linha_rotativa
    )
    RETURNING id INTO v_id;
    INSERT INTO _dup_mapa VALUES ('facilidade', r.id, v_id);
  END LOOP;

  -- Agora sim o vínculo de refinanciamento, apontando para a linha da CÓPIA.
  UPDATE modelagem_financiamento novo
     SET refinancia_facilidade_id = mp.id_novo
    FROM modelagem_financiamento antigo
    JOIN _dup_mapa mp ON mp.tabela = 'facilidade' AND mp.id_antigo = antigo.refinancia_facilidade_id
    JOIN _dup_mapa mf ON mf.tabela = 'facilidade' AND mf.id_antigo = antigo.id
   WHERE antigo.modelagem_id = p_origem
     AND antigo.refinancia_facilidade_id IS NOT NULL
     AND novo.id = mf.id_novo;

  -- ── 4. Receita (1:1) ──────────────────────────────────────────────────────
  INSERT INTO modelagem_receita (
    modelagem_id, comissao_pct, custo_cartorio_pct, modo_venda, mes_saida,
    lucro_investidores_pct, lucro_sponsor_pct
  )
  SELECT v_novo, comissao_pct, custo_cartorio_pct, modo_venda, mes_saida,
         lucro_investidores_pct, lucro_sponsor_pct
  FROM modelagem_receita WHERE modelagem_id = p_origem;

  -- ── 5. Aportes (1:1) e suas parcelas ──────────────────────────────────────
  INSERT INTO modelagem_aportes (
    modelagem_id, modo_aporte, aporte_base_total, valor_total_alvo, regra_rateio_capital
  )
  SELECT v_novo, modo_aporte, aporte_base_total, valor_total_alvo, regra_rateio_capital
  FROM modelagem_aportes WHERE modelagem_id = p_origem;

  -- Parcelas de aporte não têm filho nem são referenciadas: cópia direta.
  INSERT INTO modelagem_aporte_parcelas (modelagem_id, mes, valor, observacao)
  SELECT v_novo, mes, valor, observacao
  FROM modelagem_aporte_parcelas WHERE modelagem_id = p_origem;

  -- ── 6. Unidades → mapa ────────────────────────────────────────────────────
  FOR r IN SELECT * FROM modelagem_unidades WHERE modelagem_id = p_origem ORDER BY id LOOP
    INSERT INTO modelagem_unidades (
      modelagem_id, ordem, nome, cidade, area_sf, custo_terreno, custo_obra,
      aporte_base, preco_venda, property_tax_ano, observacoes, quantidade,
      -- `aluguel_sf_ano` (1764050000) FALTAVA. Ver o cabeçalho: sem ela a cópia
      -- de uma locação nascia com aluguel zero e receita zero.
      aluguel_sf_ano
    )
    VALUES (
      v_novo, r.ordem, r.nome, r.cidade, r.area_sf, r.custo_terreno, r.custo_obra,
      r.aporte_base, r.preco_venda, r.property_tax_ano, r.observacoes, r.quantidade,
      r.aluguel_sf_ano
    )
    RETURNING id INTO v_id;
    INSERT INTO _dup_mapa VALUES ('unidade', r.id, v_id);
  END LOOP;

  -- ── 7. Fases → mapa ───────────────────────────────────────────────────────
  FOR r IN SELECT * FROM modelagem_fases WHERE modelagem_id = p_origem ORDER BY id LOOP
    INSERT INTO modelagem_fases (modelagem_id, ordem, nome, data_inicio, data_fim)
    VALUES (v_novo, r.ordem, r.nome, r.data_inicio, r.data_fim)
    RETURNING id INTO v_id;
    INSERT INTO _dup_mapa VALUES ('fase', r.id, v_id);
  END LOOP;

  -- ── 8. Alocação unidade × fase ────────────────────────────────────────────
  INSERT INTO modelagem_unidade_fases (modelagem_id, unidade_id, fase_id, quantidade)
  SELECT v_novo, mu.id_novo, mf.id_novo, uf.quantidade
  FROM modelagem_unidade_fases uf
  JOIN _dup_mapa mu ON mu.tabela = 'unidade' AND mu.id_antigo = uf.unidade_id
  JOIN _dup_mapa mf ON mf.tabela = 'fase'    AND mf.id_antigo = uf.fase_id
  WHERE uf.modelagem_id = p_origem;

  -- ── 9. Custos → mapa, com grupo_pai NULO ──────────────────────────────────
  -- `grupo_referencia` NÃO é remapeado de propósito: é o NOME de uma categoria
  -- ('sitework', 'vertical'), não o id de um custo — não há FK e não há o que
  -- reapontar.
  FOR r IN SELECT * FROM modelagem_custos WHERE modelagem_id = p_origem ORDER BY id LOOP
    INSERT INTO modelagem_custos (
      modelagem_id, ordem, label, valor, distribuicao, mes_ancora, categoria,
      grupo_pai, base_calculo, valor_unitario, grupo_referencia, percentual, gatilho
    )
    VALUES (
      v_novo, r.ordem, r.label, r.valor, r.distribuicao, r.mes_ancora, r.categoria,
      NULL, r.base_calculo, r.valor_unitario, r.grupo_referencia, r.percentual, r.gatilho
    )
    RETURNING id INTO v_id;
    INSERT INTO _dup_mapa VALUES ('custo', r.id, v_id);
  END LOOP;

  -- Agora sim o grupo_pai, apontando para a linha da CÓPIA.
  UPDATE modelagem_custos novo
     SET grupo_pai = mp.id_novo
    FROM modelagem_custos antigo
    JOIN _dup_mapa mp ON mp.tabela = 'custo' AND mp.id_antigo = antigo.grupo_pai
    JOIN _dup_mapa mc ON mc.tabela = 'custo' AND mc.id_antigo = antigo.id
   WHERE antigo.modelagem_id = p_origem
     AND antigo.grupo_pai IS NOT NULL
     AND novo.id = mc.id_novo;

  -- ── 10. Parcelas de custo ─────────────────────────────────────────────────
  INSERT INTO modelagem_custo_parcelas (modelagem_id, custo_id, ordem, mes, valor)
  SELECT v_novo, mc.id_novo, cp.ordem, cp.mes, cp.valor
  FROM modelagem_custo_parcelas cp
  JOIN _dup_mapa mc ON mc.tabela = 'custo' AND mc.id_antigo = cp.custo_id
  WHERE cp.modelagem_id = p_origem;

  -- ── 11. Sócios → mapa ─────────────────────────────────────────────────────
  FOR r IN SELECT * FROM modelagem_socios WHERE modelagem_id = p_origem ORDER BY id LOOP
    INSERT INTO modelagem_socios (
      modelagem_id, ordem, nome, participacao_pct, cota_disponivel, observacoes, pct_capital
    )
    VALUES (v_novo, r.ordem, r.nome, r.participacao_pct, r.cota_disponivel, r.observacoes, r.pct_capital)
    RETURNING id INTO v_id;
    INSERT INTO _dup_mapa VALUES ('socio', r.id, v_id);
  END LOOP;

  -- ── 12. Aportes por sócio ─────────────────────────────────────────────────
  INSERT INTO modelagem_socio_aportes (modelagem_id, socio_id, ordem, mes, valor, observacao)
  SELECT v_novo, ms.id_novo, sa.ordem, sa.mes, sa.valor, sa.observacao
  FROM modelagem_socio_aportes sa
  JOIN _dup_mapa ms ON ms.tabela = 'socio' AND ms.id_antigo = sa.socio_id
  WHERE sa.modelagem_id = p_origem;

  -- ── 13. Takedowns ─────────────────────────────────────────────────────────
  -- `fase_id` é NULÁVEL, então LEFT JOIN: um takedown sem fase tem de continuar
  -- sem fase na cópia, e um JOIN comum o descartaria em silêncio.
  INSERT INTO modelagem_takedowns (
    modelagem_id, unidade_id, fase_id, ordem, mes, quantidade, preco_unitario, observacao
  )
  SELECT v_novo, mu.id_novo, mf.id_novo, td.ordem, td.mes, td.quantidade,
         td.preco_unitario, td.observacao
  FROM modelagem_takedowns td
  JOIN      _dup_mapa mu ON mu.tabela = 'unidade' AND mu.id_antigo = td.unidade_id
  LEFT JOIN _dup_mapa mf ON mf.tabela = 'fase'    AND mf.id_antigo = td.fase_id
  WHERE td.modelagem_id = p_origem;

  -- ── 14. Vendas por unidade ────────────────────────────────────────────────
  INSERT INTO modelagem_vendas_unidade (modelagem_id, unidade_id, mes_venda)
  SELECT v_novo, mu.id_novo, vu.mes_venda
  FROM modelagem_vendas_unidade vu
  JOIN _dup_mapa mu ON mu.tabela = 'unidade' AND mu.id_antigo = vu.unidade_id
  WHERE vu.modelagem_id = p_origem;

  -- ── 15. Overrides ─────────────────────────────────────────────────────────
  -- `created_by` é preservado: é autoria, não vínculo interno da modelagem.
  INSERT INTO modelagem_overrides (modelagem_id, cenario_id, mes, linha, valor, limpar, created_by)
  SELECT v_novo, mc.id_novo, o.mes, o.linha, o.valor, o.limpar, o.created_by
  FROM modelagem_overrides o
  JOIN _dup_mapa mc ON mc.tabela = 'cenario' AND mc.id_antigo = o.cenario_id
  WHERE o.modelagem_id = p_origem;

  -- ── 16. Curva do benchmark ────────────────────────────────────────────────
  -- Passou a depender do MAPA de facilidades: com 1:N, `financiamento_id` deixou
  -- de ser "a única facilidade" e virou um endereço que precisa ser reapontado.
  -- Ponto cuja facilidade não foi copiada é descartado pelo JOIN — não pode
  -- acontecer, porque as duas pontas vêm da mesma modelagem, e o JOIN comum é a
  -- forma de isso estourar visivelmente se um dia acontecer.
  INSERT INTO modelagem_benchmark_curva (modelagem_id, financiamento_id, mes, valor)
  SELECT v_novo, mf.id_novo, bc.mes, bc.valor
  FROM modelagem_benchmark_curva bc
  JOIN _dup_mapa mf ON mf.tabela = 'facilidade' AND mf.id_antigo = bc.financiamento_id
  WHERE bc.modelagem_id = p_origem;

  -- ── 17. Locação: cabeçalho, OPEX e curva de ocupação (1764100000) ─────────
  -- Copiadas SEM checar `tipo_modelagem`: numa modelagem de venda as três
  -- tabelas estão vazias e os INSERTs não movem linha nenhuma. Condicioná-las
  -- ao tipo criaria um caminho a mais para nada e perderia o que estivesse
  -- gravado numa modelagem que trocou de tipo por SQL administrativo — e este
  -- módulo não apaga input do usuário em silêncio.
  -- `mes_inicio_opex` (1764500000) FALTAVA. NULL nesta coluna significa
  -- "derivado do cronograma", e não "não informado": copiá-la é copiar a
  -- ESCOLHA do usuário, inclusive a escolha de deixar derivar.
  INSERT INTO modelagem_locacao (
    modelagem_id, taxa_reembolso_pct, perda_credito_pct, cap_rate_saida,
    custo_venda_pct, noi_referencia, ocupacao_estabilizada_pct, mes_inicio_opex
  )
  SELECT v_novo, taxa_reembolso_pct, perda_credito_pct, cap_rate_saida,
         custo_venda_pct, noi_referencia, ocupacao_estabilizada_pct, mes_inicio_opex
  FROM modelagem_locacao WHERE modelagem_id = p_origem;

  -- Linhas de OPEX não têm filho nem são referenciadas: cópia direta.
  INSERT INTO modelagem_opex (modelagem_id, ordem, label, valor_sf_ano, reembolsavel)
  SELECT v_novo, ordem, label, valor_sf_ano, reembolsavel
  FROM modelagem_opex WHERE modelagem_id = p_origem;

  INSERT INTO modelagem_ocupacao (modelagem_id, mes, ocupacao_pct)
  SELECT v_novo, mes, ocupacao_pct
  FROM modelagem_ocupacao WHERE modelagem_id = p_origem;

  RETURN v_novo;
END;
$$;

COMMENT ON FUNCTION duplicar_modelagem(INT, TEXT) IS
  'Duplica uma modelagem inteira (20 tabelas) numa transacao so, remapeando '
  'todas as FKs internas — inclusive as DUAS auto-referenciais: '
  'modelagem_custos.grupo_pai e modelagem_financiamento.refinancia_facilidade_id. '
  'As duas sao inseridas com NULL e reapontadas por UPDATE com o mapa; copiar o '
  'valor direto amarraria a copia na origem sem dar erro nenhum. '
  'A copia mantem tipo_modelagem e nasce com is_modelo = FALSE e status = rascunho.';

-- Objeto novo: fechado para anon, no mesmo padrão da 1760800000. O app chega
-- por app_executor.
REVOKE ALL ON FUNCTION duplicar_modelagem(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION duplicar_modelagem(INT, TEXT) FROM anon;
