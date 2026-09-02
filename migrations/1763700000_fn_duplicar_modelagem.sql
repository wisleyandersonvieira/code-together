-- Modelagem Financeira — duplicação de modelagem, no banco.
--
-- Por que uma FUNÇÃO e não um laço no cliente: são 17 tabelas, e várias
-- referenciam umas às outras por id. Copiando item a item pelo navegador, cada
-- INSERT é uma transação própria — uma falha no meio (rede, sessão, constraint)
-- deixa uma modelagem pela metade, com unidades mas sem custos, ou com
-- takedowns apontando para unidades que não existem. Aqui é tudo uma chamada
-- só: ou a modelagem inteira nasce, ou não nasce nada.
--
-- ─── A armadilha do grupo_pai ────────────────────────────────────────────────
-- `modelagem_custos.grupo_pai` referencia a PRÓPRIA tabela. Copiar o valor
-- direto não dá erro nenhum — a FK é válida, a linha existe —, mas o custo filho
-- da CÓPIA fica apontando para o custo pai da ORIGINAL. As duas modelagens ficam
-- amarradas uma na outra, e o defeito só aparece meses depois, quando alguém
-- apagar uma linha da original e a cópia mudar de agrupamento sozinha.
--
-- Por isso os custos entram com `grupo_pai = NULL` e um UPDATE separado
-- remapeia pelo mapa. Qualquer FK auto-referencial que apareça no futuro pede o
-- mesmo cuidado.
--
-- ─── Por que os mapas, e não RETURNING posicional ────────────────────────────
-- A tentação é `INSERT ... SELECT ... RETURNING id` e casar as listas pela
-- ordem. O Postgres NÃO garante que a ordem do RETURNING corresponda à do
-- SELECT: é assim que uma duplicação passa em todos os testes e erra em
-- produção, com takedown apontando para a tipologia errada. Cada tabela com
-- filhos é copiada em laço, guardando (antigo → novo) numa tabela temporária, e
-- os filhos entram por JOIN nesse mapa.
--
-- Idempotente: CREATE OR REPLACE. Chamar duas vezes cria duas cópias, que é o
-- comportamento correto de "duplicar".

CREATE OR REPLACE FUNCTION duplicar_modelagem(p_origem INT, p_nome TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_novo     INT;
  v_fin_novo INT;
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
    data_base, revisao, status, usa_fases, terreno_por_fase, is_modelo
  )
  SELECT
    empresa_id, projeto_id, COALESCE(NULLIF(p_nome, ''), nome || ' (cópia)'),
    localizacao, tipo_uso, moeda, data_inicio,
    meses_aprovacao, meses_construcao, meses_pos_obra, horizonte_maximo,
    data_base, revisao, 'rascunho', usa_fases, terreno_por_fase, FALSE
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

  -- ── 3. Financiamento (1:1) ────────────────────────────────────────────────
  -- Guarda o id novo porque `modelagem_benchmark_curva` depende dele.
  INSERT INTO modelagem_financiamento (
    modelagem_id, taxa_anual, fee_estruturacao_pct, fee_timing, fee_mes,
    mes_inicio_saque, mes_fim_saque, modo_saque, max_ltc_pct, valor_contratado,
    custo_financeiro_na_demanda, modo_amortizacao, capitalizar_juros,
    colchao_minimo_caixa, reserva_juros, reserva_juros_sacada, prazo_meses,
    carencia_meses, amortizacao_meses, balloon_no_vencimento, release_price,
    release_price_pct, convencao_juros, tipo_taxa, spread, benchmark_nome,
    benchmark_padrao, linha_rotativa
  )
  SELECT
    v_novo, taxa_anual, fee_estruturacao_pct, fee_timing, fee_mes,
    mes_inicio_saque, mes_fim_saque, modo_saque, max_ltc_pct, valor_contratado,
    custo_financeiro_na_demanda, modo_amortizacao, capitalizar_juros,
    colchao_minimo_caixa, reserva_juros, reserva_juros_sacada, prazo_meses,
    carencia_meses, amortizacao_meses, balloon_no_vencimento, release_price,
    release_price_pct, convencao_juros, tipo_taxa, spread, benchmark_nome,
    benchmark_padrao, linha_rotativa
  FROM modelagem_financiamento WHERE modelagem_id = p_origem
  RETURNING id INTO v_fin_novo;

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
      aporte_base, preco_venda, property_tax_ano, observacoes, quantidade
    )
    VALUES (
      v_novo, r.ordem, r.nome, r.cidade, r.area_sf, r.custo_terreno, r.custo_obra,
      r.aporte_base, r.preco_venda, r.property_tax_ano, r.observacoes, r.quantidade
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
  -- Depende do financiamento novo, não de mapa: a relação é 1:1.
  INSERT INTO modelagem_benchmark_curva (modelagem_id, financiamento_id, mes, valor)
  SELECT v_novo, v_fin_novo, bc.mes, bc.valor
  FROM modelagem_benchmark_curva bc
  WHERE bc.modelagem_id = p_origem;

  RETURN v_novo;
END;
$$;

COMMENT ON FUNCTION duplicar_modelagem(INT, TEXT) IS
  'Duplica uma modelagem inteira (17 tabelas) numa transacao so, remapeando '
  'todas as FKs internas — inclusive modelagem_custos.grupo_pai, que e '
  'auto-referencial. A copia nasce com is_modelo = FALSE e status = rascunho.';

-- Objeto novo: fechado para anon, no mesmo padrão da 1760800000. O app chega
-- por app_executor.
REVOKE ALL ON FUNCTION duplicar_modelagem(INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION duplicar_modelagem(INT, TEXT) FROM anon;
