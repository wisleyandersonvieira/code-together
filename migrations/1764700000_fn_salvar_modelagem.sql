-- Modelagem Financeira — o salvamento inteiro numa chamada.
--
-- ─── Por que isto existe ────────────────────────────────────────────────────
--
-- O `salvar()` do editor faz uma requisição HTTP por LINHA de cada tabela
-- filha. Numa modelagem de locação cheia deu 118 requisições e 122,4 s. A
-- medição (cronometroSalvar + Server-Timing do execute-sql) mostrou onde:
--
--   render      353 ms em 14 commits     ← 0,3%. Não é o cliente.
--   auth        5,2 s / 118 = 44 ms      ← o JWKS local funciona.
--   conexão     5,5 s / 118 = 47 ms      ← o import remoto não é o gargalo.
--   query      86,9 s / 118 = 736 ms     ← aqui.
--   isolates   110 boots para 118 requisições
--
-- E 736 ms NÃO é trabalho de banco: um UPDATE de uma linha não custa isso. O
-- cliente do postgres.js é PREGUIÇOSO — `getSql()` só instancia o objeto, e o
-- TCP, o TLS, a sessão com o Supavisor e o startup só acontecem na primeira
-- query. Com 109 de 118 requisições em isolate frio, quase toda chamada paga um
-- handshake completo, carimbado como tempo de query.
--
-- Esta função não conserta o handshake — ela para de pagá-lo 118 vezes. O
-- `rpc()` vai pelo PostgREST, que é processo permanente com pool aberto: cento e
-- dezoito apertos de mão viram zero.
--
-- ─── Paridade, e só paridade ────────────────────────────────────────────────
--
-- Cada bloco abaixo reproduz o COALESCE, o NULLIF e o GREATEST da action
-- correspondente, coluna por coluna. Isso não é zelo estético: o critério de
-- pronto é um `pg_dump --data-only` da mesma modelagem salva pelos dois
-- caminhos, e a única diferença aceitável é o valor dos `id` recriados. Um
-- COALESCE a menos aqui vira um zero onde havia NULL — e NULL, neste módulo,
-- quase sempre significa outra coisa (ver `pct_capital` e `mes_inicio_opex`).
--
-- DUAS diferenças deliberadas, e as duas são correção de bug. Contá-las é o que
-- diz ao próximo leitor onde parar de procurar — um comentário que subconta é
-- pior que nenhum:
--
--   1. Todo UPDATE e todo DELETE leva `AND modelagem_id = v_id`. Hoje as
--      actions filtram só por `id`, e um id forjado no payload grava numa
--      modelagem alheia.
--
--   2. Facilidade NOVA grava as 30 colunas de contrato. Hoje o `sincronizar()`
--      manda quem não tem id para o `criarFacilidade`, que grava seis colunas e
--      mais nada — e `AbaFinanciamento.tsx:715` faz a facilidade nova HERDAR os
--      campos de contrato da primeira. O usuário não digita nada, vê uma
--      facilidade configurada, salva, e ela volta nos DEFAULT. Pode nem
--      perceber que os números mudaram, porque não foi ele que os pôs lá.
--
-- ─── O que NÃO mudou de propósito ───────────────────────────────────────────
--
--   `grupo_pai` viaja como ID, não como índice, e sem segunda passada. A tela
--     (AbaCustos.tsx:120) só oferece como pai um custo com `c.id != null` — o
--     alvo sempre já existe. Indexar seria funcionalidade nova.
--   Sem atalho de lote nas parcelas e nos aportes. Quando todas as linhas
--     chegam sem id, o bloco genérico já apaga todas e insere todas. O atalho
--     poupava round-trips, e aqui não há round-trip a poupar.
--   `modelagem_receita` é UPDATE puro, sem upsert, como a action de hoje: numa
--     modelagem sem linha de receita o caminho antigo não grava nada, e o novo
--     também não. Paridade inclui o que está torto.
--   `modelagem_vendas_unidade` não apaga o que sumiu — o `salvar()` também não.
--
-- ─── Segurança ──────────────────────────────────────────────────────────────
--
-- SECURITY DEFINER é obrigatório: a migration 1760200000 liga RLS em toda tabela
-- do public sem policy nenhuma, e só o app_executor (BYPASSRLS) escapa. Pelo
-- rpc() quem chega é `authenticated`, negado nas modelagem_*. Sem DEFINER a
-- função enxerga zero linhas e grava zero.
--
-- E como o DEFINER fura o RLS por desenho, o gate de aprovação vem junto — o
-- MESMO `app_metadata.status = 'aprovado'` que supabase/functions/_shared/jwt.ts
-- exige antes de deixar qualquer query passar pelo execute-sql. Neste projeto o
-- signup público está habilitado: `authenticated` prova apenas que a conta
-- existe. Nem mais forte que hoje (não exige dono da modelagem — isso mudaria a
-- regra do produto), nem mais fraca.
--
-- Idempotente: CREATE OR REPLACE. Chamar duas vezes com o mesmo payload deixa o
-- banco no mesmo estado — é o que "salvar" significa.

CREATE OR REPLACE FUNCTION public.salvar_modelagem(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        int;
  v_prem      jsonb;
  v_loc       jsonb;
  v_novo      int;
  -- `v_pai` é SÓ o vínculo de paternidade (grupo_pai do custo, fase do
  -- takedown). O id devolvido por um RETURNING de linha filha vai em
  -- `v_filho` — as duas coisas já dividiram uma variável, e a próxima edição
  -- que trocasse a ordem dos blocos teria trocado um pelo outro em silêncio.
  v_pai       int;
  v_filho     int;
  r           RECORD;
  s           RECORD;
  -- Mapas índice → id. Substituem idsUnidades, idsCustos, idsSocios, idsFases e
  -- idsFacilidades, que hoje são arrays JS dentro do salvar(). 1-based, para
  -- casar direto com o `WITH ORDINALITY`.
  v_un        int[] := '{}';
  v_fa        int[] := '{}';
  v_cu        int[] := '{}';
  v_so        int[] := '{}';
  v_fac       int[] := '{}';
  -- Acumuladores do retorno para os filhos aninhados, chaveados por id do PAI.
  v_cu_par    jsonb := '{}'::jsonb;
  v_so_ap     jsonb := '{}'::jsonb;
  v_filhos    int[];
  -- Listas planas do retorno. Inicializadas com '{}' e não NULL: uma modelagem
  -- sem OPEX tem de devolver `[]`, não `null` — o cliente itera sobre elas.
  v_out_aporte_parcelas int[] := '{}';
  v_out_opex            int[] := '{}';
  v_out_takedowns       int[] := '{}';
BEGIN
  -- ── 0. Gate de autorização ────────────────────────────────────────────────
  -- Paridade com _shared/jwt.ts. O GoTrue embute app_metadata nos claims do
  -- access token, então isto é leitura local: nenhuma ida ao auth.users.
  -- 42501 = insufficient_privilege, que o PostgREST devolve como 403.
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'status', '') <> 'aprovado' THEN
    RAISE EXCEPTION 'Conta pendente de aprovação por um administrador'
      USING ERRCODE = '42501';
  END IF;

  v_id   := NULLIF(p_payload ->> 'id', '')::int;
  v_prem := p_payload -> 'premissas';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'salvar_modelagem: payload sem id de modelagem';
  END IF;

  -- Trava a linha da modelagem até o fim da transação. Dois salvamentos
  -- concorrentes da MESMA modelagem serializam aqui em vez de intercalar
  -- INSERTs e DELETEs de tabelas filhas — que é como um salvamento perderia
  -- linhas do outro sem erro nenhum.
  --
  -- Com teto de espera: sem ele, uma sessão travada do outro lado faz esta
  -- esperar para sempre, e o usuário vê o botão girando sem fim — que é pior
  -- que um erro, porque não tem fim nem diagnóstico. LOCAL: vale só até o fim
  -- desta transação e não vaza para a conexão seguinte do pool.
  SET LOCAL lock_timeout = '5s';
  PERFORM 1 FROM modelagens WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'salvar_modelagem: modelagem % não existe', v_id;
  END IF;

  -- ── 1. Premissas ──────────────────────────────────────────────────────────
  UPDATE modelagens SET
    nome             = COALESCE(v_prem ->> 'nome', ''),
    localizacao      = COALESCE(v_prem ->> 'localizacao', ''),
    tipo_uso         = COALESCE(v_prem ->> 'tipo_uso', ''),
    moeda            = COALESCE(NULLIF(v_prem ->> 'moeda', ''), 'USD'),
    data_inicio      = (v_prem ->> 'data_inicio')::date,
    meses_aprovacao  = (v_prem ->> 'meses_aprovacao')::int,
    meses_construcao = (v_prem ->> 'meses_construcao')::int,
    meses_pos_obra   = (v_prem ->> 'meses_pos_obra')::int,
    horizonte_maximo = (v_prem ->> 'horizonte_maximo')::int,
    usa_fases        = COALESCE((v_prem ->> 'usa_fases')::boolean, FALSE),
    terreno_por_fase = COALESCE((v_prem ->> 'terreno_por_fase')::boolean, FALSE),
    data_base        = NULLIF(v_prem ->> 'data_base', '')::date,
    revisao          = COALESCE(v_prem ->> 'revisao', ''),
    -- COALESCE contra a COLUNA, não contra um literal: o cliente manda `status`
    -- nulo e o valor gravado tem de ficar como está. É o que a action faz.
    status           = COALESCE(v_prem ->> 'status', status),
    updated_at       = CURRENT_TIMESTAMP
  WHERE id = v_id;

  -- ── 2. Unidades ───────────────────────────────────────────────────────────
  -- O DELETE vem antes do INSERT em toda lista, e não é otimização: as tabelas
  -- com UNIQUE natural (aporte_parcelas por mês, benchmark por mês) estouram na
  -- ordem inversa. O `salvar()` já apaga primeiro pelo mesmo motivo.
  --
  -- `COALESCE(id, -1)`: id ausente vira um valor que não casa com nenhuma linha,
  -- em vez de NULL — `id <> ALL (array com NULL)` devolve NULL, nunca TRUE, e o
  -- DELETE não apagaria nada. Um `<> ALL` com NULL dentro é sempre bug.
  DELETE FROM modelagem_unidades
   WHERE modelagem_id = v_id
     AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                      FROM jsonb_array_elements(COALESCE(p_payload -> 'unidades', '[]'::jsonb)) e);

  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'unidades', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
      UPDATE modelagem_unidades SET
        ordem            = COALESCE((r.e ->> 'ordem')::int, ordem),
        nome             = COALESCE(r.e ->> 'nome', ''),
        cidade           = COALESCE(r.e ->> 'cidade', ''),
        quantidade       = GREATEST(1, COALESCE((r.e ->> 'quantidade')::int, 1)),
        area_sf          = COALESCE((r.e ->> 'area_sf')::decimal, 0),
        custo_terreno    = COALESCE((r.e ->> 'custo_terreno')::decimal, 0),
        custo_obra       = COALESCE((r.e ->> 'custo_obra')::decimal, 0),
        preco_venda      = COALESCE((r.e ->> 'preco_venda')::decimal, 0),
        property_tax_ano = COALESCE((r.e ->> 'property_tax_ano')::decimal, 0),
        aluguel_sf_ano   = COALESCE((r.e ->> 'aluguel_sf_ano')::decimal, 0),
        observacoes      = COALESCE(r.e ->> 'observacoes', ''),
        updated_at       = CURRENT_TIMESTAMP
      WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
      RETURNING id INTO v_novo;
    ELSE
      INSERT INTO modelagem_unidades (
        modelagem_id, ordem, nome, cidade, quantidade, area_sf, custo_terreno,
        custo_obra, preco_venda, property_tax_ano, aluguel_sf_ano, observacoes
      ) VALUES (
        v_id,
        COALESCE((r.e ->> 'ordem')::int, 0),
        COALESCE(r.e ->> 'nome', ''),
        COALESCE(r.e ->> 'cidade', ''),
        GREATEST(1, COALESCE((r.e ->> 'quantidade')::int, 1)),
        COALESCE((r.e ->> 'area_sf')::decimal, 0),
        COALESCE((r.e ->> 'custo_terreno')::decimal, 0),
        COALESCE((r.e ->> 'custo_obra')::decimal, 0),
        COALESCE((r.e ->> 'preco_venda')::decimal, 0),
        COALESCE((r.e ->> 'property_tax_ano')::decimal, 0),
        COALESCE((r.e ->> 'aluguel_sf_ano')::decimal, 0),
        COALESCE(r.e ->> 'observacoes', '')
      ) RETURNING id INTO v_novo;
    END IF;
    -- Um id que não casou (linha de outra modelagem) deixa v_novo NULL. O mapa
    -- guarda NULL e os filhos que dependem dele são pulados, exatamente como o
    -- `salvar()` pula quando `idsUnidades[i]` vem nulo.
    v_un := v_un || v_novo;
  END LOOP;

  -- ── 3. Custos ─────────────────────────────────────────────────────────────
  DELETE FROM modelagem_custos
   WHERE modelagem_id = v_id
     AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                      FROM jsonb_array_elements(COALESCE(p_payload -> 'custos', '[]'::jsonb)) e);

  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'custos', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    v_pai := NULLIF(r.e ->> 'grupo_pai_id', '')::int;
    IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
      UPDATE modelagem_custos SET
        ordem            = COALESCE((r.e ->> 'ordem')::int, ordem),
        label            = COALESCE(r.e ->> 'label', ''),
        valor            = COALESCE((r.e ->> 'valor')::decimal, 0),
        distribuicao     = COALESCE(r.e ->> 'distribuicao', ''),
        -- Mesma guarda do pct_capital: NULL é "sem âncora, usa a distribuição",
        -- e chave ausente é "não mexa". Ver o comentário no bloco 5.
        mes_ancora       = CASE WHEN r.e ? 'mes_ancora'
                                THEN NULLIF(r.e ->> 'mes_ancora', '')::int
                                ELSE modelagem_custos.mes_ancora END,
        categoria        = COALESCE(NULLIF(r.e ->> 'categoria', ''), 'outros'),
        -- NULLIF em torno do próprio id: uma linha não pode ser pai de si mesma,
        -- e o ciclo de tamanho 1 é o único que a interface consegue produzir.
        -- Mesma guarda de updateModelagemCusto.
        grupo_pai        = NULLIF(v_pai, (r.e ->> 'id')::int),
        base_calculo     = COALESCE(NULLIF(r.e ->> 'base_calculo', ''), 'total'),
        valor_unitario   = COALESCE((r.e ->> 'valor_unitario')::decimal, 0),
        grupo_referencia = NULLIF(NULLIF(r.e ->> 'grupo_referencia', ''), 'null'),
        percentual       = COALESCE((r.e ->> 'percentual')::decimal, 0),
        gatilho          = COALESCE(NULLIF(r.e ->> 'gatilho', ''), 'cronograma')
      WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
      RETURNING id INTO v_novo;
    ELSE
      INSERT INTO modelagem_custos (
        modelagem_id, ordem, label, valor, distribuicao, mes_ancora, categoria,
        grupo_pai, base_calculo, valor_unitario, grupo_referencia, percentual, gatilho
      ) VALUES (
        v_id,
        COALESCE((r.e ->> 'ordem')::int, 0),
        COALESCE(r.e ->> 'label', ''),
        COALESCE((r.e ->> 'valor')::decimal, 0),
        COALESCE(NULLIF(r.e ->> 'distribuicao', ''), 'linear_construction'),
        NULLIF(r.e ->> 'mes_ancora', '')::int,
        COALESCE(NULLIF(r.e ->> 'categoria', ''), 'outros'),
        v_pai,
        COALESCE(NULLIF(r.e ->> 'base_calculo', ''), 'total'),
        COALESCE((r.e ->> 'valor_unitario')::decimal, 0),
        NULLIF(NULLIF(r.e ->> 'grupo_referencia', ''), 'null'),
        COALESCE((r.e ->> 'percentual')::decimal, 0),
        COALESCE(NULLIF(r.e ->> 'gatilho', ''), 'cronograma')
      ) RETURNING id INTO v_novo;
    END IF;
    v_cu := v_cu || v_novo;

    -- ── 4. Parcelas do custo ────────────────────────────────────────────────
    -- Aninhadas: o vínculo pai↔filho é a estrutura do JSON, e a função nunca
    -- precisa de índice para reencontrá-las. Custo removido não precisa de nada
    -- — modelagem_custo_parcelas.custo_id tem ON DELETE CASCADE.
    IF v_novo IS NOT NULL THEN
      DELETE FROM modelagem_custo_parcelas
       WHERE custo_id = v_novo AND modelagem_id = v_id
         AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                          FROM jsonb_array_elements(COALESCE(r.e -> 'parcelas', '[]'::jsonb)) e);

      v_filhos := '{}';
      FOR s IN SELECT e, i FROM jsonb_array_elements(COALESCE(r.e -> 'parcelas', '[]'::jsonb))
                           WITH ORDINALITY t(e, i) ORDER BY i
      LOOP
        IF NULLIF(s.e ->> 'id', '') IS NOT NULL THEN
          UPDATE modelagem_custo_parcelas SET
            ordem = COALESCE((s.e ->> 'ordem')::int, ordem),
            mes   = GREATEST(1, COALESCE((s.e ->> 'mes')::int, mes)),
            valor = COALESCE((s.e ->> 'valor')::decimal, 0)
          WHERE id = (s.e ->> 'id')::int AND modelagem_id = v_id
          RETURNING id INTO v_filho;
        ELSE
          INSERT INTO modelagem_custo_parcelas (modelagem_id, custo_id, ordem, mes, valor)
          VALUES (
            v_id, v_novo,
            COALESCE((s.e ->> 'ordem')::int, 0),
            GREATEST(1, COALESCE((s.e ->> 'mes')::int, 1)),
            COALESCE((s.e ->> 'valor')::decimal, 0)
          ) RETURNING id INTO v_filho;
        END IF;
        v_filhos := v_filhos || v_filho;
      END LOOP;
      v_cu_par := v_cu_par || jsonb_build_object(v_novo::text, to_jsonb(v_filhos));
    END IF;
  END LOOP;

  -- ── 5. Sócios ─────────────────────────────────────────────────────────────
  DELETE FROM modelagem_socios
   WHERE modelagem_id = v_id
     AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                      FROM jsonb_array_elements(COALESCE(p_payload -> 'socios', '[]'::jsonb)) e);

  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'socios', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
      UPDATE modelagem_socios SET
        ordem            = COALESCE((r.e ->> 'ordem')::int, ordem),
        nome             = COALESCE(r.e ->> 'nome', ''),
        participacao_pct = COALESCE((r.e ->> 'participacao_pct')::decimal, 0),
        cota_disponivel  = COALESCE((r.e ->> 'cota_disponivel')::boolean, FALSE),
        -- NULL aqui significa "usa a participação", que é diferente de zero,
        -- "não põe capital nenhum". O duplo NULLIF é o de updateModelagemSocio:
        -- string vazia e a string literal 'null' também viram NULL.
        --
        -- E a guarda `?` antes de ler: `->>` devolve NULL tanto para chave
        -- ausente quanto para null explícito, e aqui os dois querem dizer coisas
        -- diferentes — "não mexa" e "volte a usar a participação". O
        -- payloadSalvar.ts sempre emite a chave, mas isso é contrato entre dois
        -- arquivos em duas linguagens sem teste que os amarre; o motivo de a
        -- lógica ter vindo para o banco é o banco virar o contrato.
        pct_capital      = CASE WHEN r.e ? 'pct_capital'
                                THEN NULLIF(NULLIF(r.e ->> 'pct_capital', ''), 'null')::decimal
                                ELSE modelagem_socios.pct_capital END,
        observacoes      = COALESCE(r.e ->> 'observacoes', '')
      WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
      RETURNING id INTO v_novo;
    ELSE
      INSERT INTO modelagem_socios (
        modelagem_id, ordem, nome, participacao_pct, cota_disponivel, pct_capital, observacoes
      ) VALUES (
        v_id,
        COALESCE((r.e ->> 'ordem')::int, 0),
        COALESCE(r.e ->> 'nome', ''),
        COALESCE((r.e ->> 'participacao_pct')::decimal, 0),
        COALESCE((r.e ->> 'cota_disponivel')::boolean, FALSE),
        NULLIF(NULLIF(r.e ->> 'pct_capital', ''), 'null')::decimal,
        COALESCE(r.e ->> 'observacoes', '')
      ) RETURNING id INTO v_novo;
    END IF;
    v_so := v_so || v_novo;

    -- ── 6. Aportes do sócio ─────────────────────────────────────────────────
    IF v_novo IS NOT NULL THEN
      DELETE FROM modelagem_socio_aportes
       WHERE socio_id = v_novo AND modelagem_id = v_id
         AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                          FROM jsonb_array_elements(COALESCE(r.e -> 'aportes', '[]'::jsonb)) e);

      v_filhos := '{}';
      FOR s IN SELECT e, i FROM jsonb_array_elements(COALESCE(r.e -> 'aportes', '[]'::jsonb))
                           WITH ORDINALITY t(e, i) ORDER BY i
      LOOP
        IF NULLIF(s.e ->> 'id', '') IS NOT NULL THEN
          UPDATE modelagem_socio_aportes SET
            ordem      = COALESCE((s.e ->> 'ordem')::int, ordem),
            mes        = GREATEST(1, COALESCE((s.e ->> 'mes')::int, mes)),
            valor      = COALESCE((s.e ->> 'valor')::decimal, 0),
            observacao = NULLIF(COALESCE(s.e ->> 'observacao', ''), '')
          WHERE id = (s.e ->> 'id')::int AND modelagem_id = v_id
          RETURNING id INTO v_filho;
        ELSE
          INSERT INTO modelagem_socio_aportes (modelagem_id, socio_id, ordem, mes, valor, observacao)
          VALUES (
            v_id, v_novo,
            COALESCE((s.e ->> 'ordem')::int, 0),
            GREATEST(1, COALESCE((s.e ->> 'mes')::int, 1)),
            COALESCE((s.e ->> 'valor')::decimal, 0),
            NULLIF(COALESCE(s.e ->> 'observacao', ''), '')
          ) RETURNING id INTO v_filho;
        END IF;
        v_filhos := v_filhos || v_filho;
      END LOOP;
      v_so_ap := v_so_ap || jsonb_build_object(v_novo::text, to_jsonb(v_filhos));
    END IF;
  END LOOP;

  -- ── 7. Plano de aportes (1:1) e suas parcelas ─────────────────────────────
  -- O cabeçalho vai antes: se ele falhar, não faz sentido gravar parcela.
  IF p_payload ? 'aportes' AND jsonb_typeof(p_payload -> 'aportes') = 'object' THEN
    INSERT INTO modelagem_aportes (
      modelagem_id, modo_aporte, aporte_base_total, valor_total_alvo, regra_rateio_capital
    ) VALUES (
      v_id,
      COALESCE(p_payload -> 'aportes' ->> 'modo_aporte', ''),
      COALESCE((p_payload -> 'aportes' ->> 'aporte_base_total')::decimal, 0),
      COALESCE((p_payload -> 'aportes' ->> 'valor_total_alvo')::decimal, 0),
      COALESCE(NULLIF(p_payload -> 'aportes' ->> 'regra_rateio_capital', ''), 'participacao')
    )
    ON CONFLICT (modelagem_id) DO UPDATE SET
      modo_aporte          = EXCLUDED.modo_aporte,
      aporte_base_total    = EXCLUDED.aporte_base_total,
      valor_total_alvo     = EXCLUDED.valor_total_alvo,
      regra_rateio_capital = EXCLUDED.regra_rateio_capital,
      updated_at           = CURRENT_TIMESTAMP;

    DELETE FROM modelagem_aporte_parcelas
     WHERE modelagem_id = v_id
       AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                        FROM jsonb_array_elements(
                               COALESCE(p_payload -> 'aportes' -> 'parcelas', '[]'::jsonb)) e);

    v_filhos := '{}';
    FOR r IN SELECT e, i FROM jsonb_array_elements(
                                COALESCE(p_payload -> 'aportes' -> 'parcelas', '[]'::jsonb))
                         WITH ORDINALITY t(e, i) ORDER BY i
    LOOP
      IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
        UPDATE modelagem_aporte_parcelas SET
          mes        = GREATEST(1, COALESCE((r.e ->> 'mes')::int, mes)),
          valor      = COALESCE((r.e ->> 'valor')::decimal, 0),
          observacao = NULLIF(COALESCE(r.e ->> 'observacao', ''), '')
        WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
        RETURNING id INTO v_novo;
      ELSE
        -- Upsert por (modelagem_id, mes), como createModelagemAporteParcela: a
        -- célula do fluxo grava parcela na hora, então uma linha "nova" pode
        -- colidir com um mês que já existe.
        INSERT INTO modelagem_aporte_parcelas (modelagem_id, mes, valor, observacao)
        VALUES (
          v_id,
          GREATEST(1, COALESCE((r.e ->> 'mes')::int, 1)),
          COALESCE((r.e ->> 'valor')::decimal, 0),
          NULLIF(COALESCE(r.e ->> 'observacao', ''), '')
        )
        ON CONFLICT (modelagem_id, mes) DO UPDATE SET
          valor = EXCLUDED.valor, observacao = EXCLUDED.observacao
        RETURNING id INTO v_novo;
      END IF;
      v_filhos := v_filhos || v_novo;
    END LOOP;
    v_out_aporte_parcelas := v_filhos;
  END IF;

  -- ── 8. Fases ──────────────────────────────────────────────────────────────
  DELETE FROM modelagem_fases
   WHERE modelagem_id = v_id
     AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                      FROM jsonb_array_elements(COALESCE(p_payload -> 'fases', '[]'::jsonb)) e);

  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'fases', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
      UPDATE modelagem_fases SET
        ordem       = COALESCE((r.e ->> 'ordem')::int, ordem),
        nome        = COALESCE(r.e ->> 'nome', ''),
        data_inicio = (r.e ->> 'data_inicio')::date,
        data_fim    = (r.e ->> 'data_fim')::date
      WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
      RETURNING id INTO v_novo;
    ELSE
      INSERT INTO modelagem_fases (modelagem_id, ordem, nome, data_inicio, data_fim)
      VALUES (
        v_id,
        COALESCE((r.e ->> 'ordem')::int, 0),
        COALESCE(r.e ->> 'nome', ''),
        (r.e ->> 'data_inicio')::date,
        (r.e ->> 'data_fim')::date
      ) RETURNING id INTO v_novo;
    END IF;
    v_fa := v_fa || v_novo;
  END LOOP;

  -- ── 9. Alocação unidade × fase ────────────────────────────────────────────
  -- Chave natural: o par. A linha não tem identidade na tela, e quantidade ZERO
  -- é ausência — o `salvar()` filtra `a.quantidade > 0` antes de montar o mapa,
  -- e o que não entrou no mapa é apagado.
  DELETE FROM modelagem_unidade_fases uf
   WHERE uf.modelagem_id = v_id
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload -> 'alocacoes', '[]'::jsonb)) a
        WHERE COALESCE((a ->> 'quantidade')::int, 0) > 0
          AND v_un[(a ->> 'unidade_index')::int + 1] = uf.unidade_id
          AND v_fa[(a ->> 'fase_index')::int + 1]    = uf.fase_id
     );

  FOR r IN SELECT e FROM jsonb_array_elements(COALESCE(p_payload -> 'alocacoes', '[]'::jsonb)) e
  LOOP
    -- Quantidade zero É ausência, e continua sendo filtro legítimo: o
    -- `salvar()` faz o mesmo antes de montar o mapa. Não confundir com o
    -- índice que não resolve, logo abaixo.
    CONTINUE WHEN COALESCE((r.e ->> 'quantidade')::int, 0) <= 0;
    v_novo := v_un[(r.e ->> 'unidade_index')::int + 1];
    v_pai  := v_fa[(r.e ->> 'fase_index')::int + 1];
  -- ─── Índice que não resolve é ERRO, não linha a descartar ────────────────
  -- `v_un[i]` só vem NULL com `unidade_index` fora do array ou com um UPDATE
  -- que não casou — id forjado, ou de outra modelagem. Em payload correto é
  -- impossível: é erro de integridade, da mesma família do "payload sem id".
  --
  -- E descartar em silêncio seria o modo de falha que este módulo evita acima
  -- de todos: some uma linha que o usuário criou, o resto grava, e a tela diz
  -- "Modelagem salva". A exceção aborta a transação inteira — nada fica
  -- gravado pela metade, que é exatamente o que a atomicidade foi comprar.
    IF v_novo IS NULL OR v_pai IS NULL THEN
      RAISE EXCEPTION 'salvar_modelagem: alocacoes — unidade_index % / fase_index % não resolvem',
        r.e ->> 'unidade_index', r.e ->> 'fase_index';
    END IF;
    INSERT INTO modelagem_unidade_fases (modelagem_id, unidade_id, fase_id, quantidade)
    VALUES (v_id, v_novo, v_pai, GREATEST(0, COALESCE((r.e ->> 'quantidade')::int, 0)))
    ON CONFLICT (unidade_id, fase_id) DO UPDATE SET quantidade = EXCLUDED.quantidade;
  END LOOP;

  -- ── 10. Facilidades — passada 1, sem o vínculo ────────────────────────────
  -- `refinancia_facilidade_id` é FK para a PRÓPRIA tabela, e a facilidade
  -- apontada pode ser uma que ainda não existe quando a primeira é gravada.
  -- Mandar o vínculo agora faria a FK estourar — ou, pior, gravar NULL em
  -- silêncio. Mesma dança do grupo_pai na duplicar_modelagem.
  DELETE FROM modelagem_financiamento
   WHERE modelagem_id = v_id
     AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                      FROM jsonb_array_elements(COALESCE(p_payload -> 'facilidades', '[]'::jsonb)) e);

  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'facilidades', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    IF NULLIF(r.e ->> 'id', '') IS NULL THEN
      INSERT INTO modelagem_financiamento (modelagem_id, ordem, nome, ativo)
      VALUES (v_id, COALESCE((r.e ->> 'ordem')::int, 0),
              COALESCE(NULLIF(r.e ->> 'nome', ''), 'Financiamento'), TRUE)
      RETURNING id INTO v_novo;
    ELSE
      v_novo := (r.e ->> 'id')::int;
    END IF;

    UPDATE modelagem_financiamento SET
      ordem                       = COALESCE((r.e ->> 'ordem')::int, 0),
      nome                        = COALESCE(NULLIF(r.e ->> 'nome', ''), 'Financiamento'),
      ativo                       = COALESCE((r.e ->> 'ativo')::boolean, TRUE),
      refinancia_facilidade_id    = NULL,
      taxa_anual                  = COALESCE((r.e ->> 'taxa_anual')::decimal, 0),
      fee_estruturacao_pct        = COALESCE((r.e ->> 'fee_estruturacao_pct')::decimal, 0),
      fee_timing                  = COALESCE(r.e ->> 'fee_timing', ''),
      fee_mes                     = NULLIF(r.e ->> 'fee_mes', '')::int,
      mes_inicio_saque            = COALESCE((r.e ->> 'mes_inicio_saque')::int, 1),
      mes_fim_saque               = COALESCE((r.e ->> 'mes_fim_saque')::int, 1),
      modo_saque                  = COALESCE(r.e ->> 'modo_saque', ''),
      max_ltc_pct                 = NULLIF(r.e ->> 'max_ltc_pct', '')::decimal,
      valor_contratado            = NULLIF(r.e ->> 'valor_contratado', '')::decimal,
      custo_financeiro_na_demanda = COALESCE((r.e ->> 'custo_financeiro_na_demanda')::boolean, FALSE),
      modo_amortizacao            = COALESCE(r.e ->> 'modo_amortizacao', ''),
      capitalizar_juros           = COALESCE((r.e ->> 'capitalizar_juros')::boolean, FALSE),
      colchao_minimo_caixa        = COALESCE((r.e ->> 'colchao_minimo_caixa')::decimal, 0),
      linha_rotativa              = COALESCE((r.e ->> 'linha_rotativa')::boolean, FALSE),
      reserva_juros               = COALESCE((r.e ->> 'reserva_juros')::decimal, 0),
      reserva_juros_sacada        = COALESCE((r.e ->> 'reserva_juros_sacada')::boolean, TRUE),
      prazo_meses                 = NULLIF(r.e ->> 'prazo_meses', '')::int,
      carencia_meses              = COALESCE((r.e ->> 'carencia_meses')::int, 0),
      amortizacao_meses           = NULLIF(r.e ->> 'amortizacao_meses', '')::int,
      balloon_no_vencimento       = COALESCE((r.e ->> 'balloon_no_vencimento')::boolean, TRUE),
      release_price               = COALESCE((r.e ->> 'release_price')::decimal, 0),
      release_price_pct           = NULLIF(r.e ->> 'release_price_pct', '')::decimal,
      convencao_juros             = COALESCE(NULLIF(r.e ->> 'convencao_juros', ''), 'mensal_12'),
      tipo_taxa                   = COALESCE(NULLIF(r.e ->> 'tipo_taxa', ''), 'fixa'),
      spread                      = COALESCE((r.e ->> 'spread')::decimal, 0),
      benchmark_nome              = NULLIF(NULLIF(r.e ->> 'benchmark_nome', ''), 'null'),
      benchmark_padrao            = COALESCE((r.e ->> 'benchmark_padrao')::decimal, 0),
      updated_at                  = CURRENT_TIMESTAMP
    WHERE id = v_novo AND modelagem_id = v_id;

    v_fac := v_fac || v_novo;
  END LOOP;

  -- ── 11. Facilidades — passada 2, o vínculo ────────────────────────────────
  -- Só as que DECLARAM refinanciamento. `jsonb_typeof = 'number'` e não
  -- `IS NOT NULL`: chave ausente e null explícito são o mesmo NULL para `->>`,
  -- e aqui os dois significam "não refinancia".
  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'facilidades', '[]'::jsonb))
                       WITH ORDINALITY t(e, i)
             WHERE jsonb_typeof(e -> 'refinancia_index') = 'number'
  LOOP
    UPDATE modelagem_financiamento
       SET refinancia_facilidade_id = v_fac[(r.e ->> 'refinancia_index')::int + 1]
     WHERE id = v_fac[r.i] AND modelagem_id = v_id;
  END LOOP;

  -- ── 12. Curva do benchmark, por facilidade ────────────────────────────────
  -- Chave natural (financiamento_id, mes). Apagar um ponto é diferente de
  -- gravá-lo com zero: sem linha, o motor usa `benchmark_padrao`.
  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'facilidades', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    v_novo := v_fac[r.i];
    CONTINUE WHEN v_novo IS NULL;

    DELETE FROM modelagem_benchmark_curva
     WHERE modelagem_id = v_id AND financiamento_id = v_novo
       AND mes <> ALL (SELECT trunc((p ->> 'mes')::decimal)::int
                         FROM jsonb_array_elements(COALESCE(r.e -> 'benchmark_curva', '[]'::jsonb)) p);

    INSERT INTO modelagem_benchmark_curva (modelagem_id, financiamento_id, mes, valor)
    SELECT v_id, v_novo,
           GREATEST(1, COALESCE((p ->> 'mes')::int, 1)),
           COALESCE((p ->> 'valor')::decimal, 0)
      FROM jsonb_array_elements(COALESCE(r.e -> 'benchmark_curva', '[]'::jsonb)) p
    ON CONFLICT (financiamento_id, mes) DO UPDATE SET valor = EXCLUDED.valor;
  END LOOP;

  -- ── 13. Receita (1:1) ─────────────────────────────────────────────────────
  -- UPDATE puro, sem upsert — igual a saveModelagemReceita. Numa modelagem sem
  -- linha de receita isto não grava nada, exatamente como hoje.
  --
  -- `receita` ausente é EXCEÇÃO, não guarda silenciosa. O cliente sempre a
  -- emite (payloadSalvar.ts), então a ausência é payload malformado — e a
  -- alternativa é o pior desfecho possível: não gravar receita nenhuma, em
  -- silêncio, e ainda reportar "Modelagem salva".
  --
  -- É diferente de `aportes` e `locacao`, logo abaixo, que são legitimamente
  -- opcionais e por isso seguem com guarda silenciosa.
  IF NOT (p_payload ? 'receita') OR jsonb_typeof(p_payload -> 'receita') <> 'object' THEN
    RAISE EXCEPTION 'salvar_modelagem: payload sem o bloco receita';
  END IF;
  UPDATE modelagem_receita SET
    comissao_pct           = COALESCE((p_payload -> 'receita' ->> 'comissao_pct')::decimal, 0),
    custo_cartorio_pct     = COALESCE((p_payload -> 'receita' ->> 'custo_cartorio_pct')::decimal, 0),
    modo_venda             = COALESCE(p_payload -> 'receita' ->> 'modo_venda', ''),
    mes_saida              = NULLIF(p_payload -> 'receita' ->> 'mes_saida', '')::int,
    lucro_investidores_pct = COALESCE((p_payload -> 'receita' ->> 'lucro_investidores_pct')::decimal, 0),
    lucro_sponsor_pct      = COALESCE((p_payload -> 'receita' ->> 'lucro_sponsor_pct')::decimal, 0),
    updated_at             = CURRENT_TIMESTAMP
  WHERE modelagem_id = v_id;

  -- ── 14. Modo locação: cabeçalho, OPEX e ocupação ──────────────────────────
  -- Só quando o tipo é 'locacao'. Numa venda os três blocos não têm o que
  -- gravar, e chamá-los criaria linha de cabeçalho — inofensiva, mas mentirosa.
  v_loc := p_payload -> 'locacao';
  IF (v_prem ->> 'tipo_modelagem') = 'locacao'
     AND v_loc IS NOT NULL AND jsonb_typeof(v_loc) = 'object' THEN

    INSERT INTO modelagem_locacao (
      modelagem_id, taxa_reembolso_pct, perda_credito_pct, cap_rate_saida,
      custo_venda_pct, noi_referencia, ocupacao_estabilizada_pct, mes_inicio_opex
    ) VALUES (
      v_id,
      COALESCE((v_loc ->> 'taxa_reembolso_pct')::decimal, 0),
      COALESCE((v_loc ->> 'perda_credito_pct')::decimal, 0),
      COALESCE((v_loc ->> 'cap_rate_saida')::decimal, 0),
      COALESCE((v_loc ->> 'custo_venda_pct')::decimal, 0),
      COALESCE(NULLIF(v_loc ->> 'noi_referencia', ''), 'estabilizado'),
      COALESCE((v_loc ->> 'ocupacao_estabilizada_pct')::decimal, 1),
      -- `mes_inicio_opex` NULL significa "derivado do cronograma", NÃO "não
      -- informado". Chave ausente preserva o que está gravado; null explícito
      -- grava NULL. `->>` sozinho não distingue os dois — só o operador `?`.
      CASE WHEN v_loc ? 'mes_inicio_opex'
           THEN NULLIF(v_loc ->> 'mes_inicio_opex', '')::int
           ELSE (SELECT l.mes_inicio_opex FROM modelagem_locacao l WHERE l.modelagem_id = v_id)
      END
    )
    ON CONFLICT (modelagem_id) DO UPDATE SET
      taxa_reembolso_pct        = EXCLUDED.taxa_reembolso_pct,
      perda_credito_pct         = EXCLUDED.perda_credito_pct,
      cap_rate_saida            = EXCLUDED.cap_rate_saida,
      custo_venda_pct           = EXCLUDED.custo_venda_pct,
      noi_referencia            = EXCLUDED.noi_referencia,
      ocupacao_estabilizada_pct = EXCLUDED.ocupacao_estabilizada_pct,
      mes_inicio_opex           = EXCLUDED.mes_inicio_opex,
      updated_at                = CURRENT_TIMESTAMP;

    DELETE FROM modelagem_opex
     WHERE modelagem_id = v_id
       AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                        FROM jsonb_array_elements(COALESCE(p_payload -> 'opex', '[]'::jsonb)) e);

    v_filhos := '{}';
    FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'opex', '[]'::jsonb))
                         WITH ORDINALITY t(e, i) ORDER BY i
    LOOP
      IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
        UPDATE modelagem_opex SET
          ordem        = COALESCE((r.e ->> 'ordem')::int, ordem),
          label        = COALESCE(r.e ->> 'label', ''),
          valor_sf_ano = COALESCE((r.e ->> 'valor_sf_ano')::decimal, 0),
          reembolsavel = COALESCE((r.e ->> 'reembolsavel')::boolean, TRUE)
        WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
        RETURNING id INTO v_novo;
      ELSE
        INSERT INTO modelagem_opex (modelagem_id, ordem, label, valor_sf_ano, reembolsavel)
        VALUES (
          v_id,
          COALESCE((r.e ->> 'ordem')::int, 0),
          COALESCE(r.e ->> 'label', ''),
          COALESCE((r.e ->> 'valor_sf_ano')::decimal, 0),
          COALESCE((r.e ->> 'reembolsavel')::boolean, TRUE)
        ) RETURNING id INTO v_novo;
      END IF;
      v_filhos := v_filhos || v_novo;
    END LOOP;
    v_out_opex := v_filhos;

    -- Ocupação: chave natural é o MÊS. Mês ausente é ocupação zero, então
    -- apagar e gravar zero dão o mesmo número — mas um mês SEM linha diz "ainda
    -- não preenchi", e um zero declarado diz "aqui é vazio de propósito".
    DELETE FROM modelagem_ocupacao
     WHERE modelagem_id = v_id
       AND mes <> ALL (SELECT trunc((e ->> 'mes')::decimal)::int
                         FROM jsonb_array_elements(COALESCE(p_payload -> 'ocupacao', '[]'::jsonb)) e);

    INSERT INTO modelagem_ocupacao (modelagem_id, mes, ocupacao_pct)
    SELECT v_id,
           GREATEST(1, COALESCE((e ->> 'mes')::int, 1)),
           LEAST(1, GREATEST(0, COALESCE((e ->> 'ocupacao_pct')::decimal, 0)))
      FROM jsonb_array_elements(COALESCE(p_payload -> 'ocupacao', '[]'::jsonb)) e
    ON CONFLICT (modelagem_id, mes) DO UPDATE SET ocupacao_pct = EXCLUDED.ocupacao_pct;
  END IF;

  -- ── 15. Vendas por unidade ────────────────────────────────────────────────
  -- Upsert sem DELETE: o `salvar()` também não apaga o que sumiu daqui.
  -- Paridade inclui manter o que está torto — mudar isso é outra branch.
  FOR r IN SELECT e FROM jsonb_array_elements(COALESCE(p_payload -> 'vendas_unidade', '[]'::jsonb)) e
  LOOP
    v_novo := v_un[(r.e ->> 'unidade_index')::int + 1];
    -- Mesma regra das alocações: ver a nota lá em cima.
    IF v_novo IS NULL THEN
      RAISE EXCEPTION 'salvar_modelagem: vendas_unidade — unidade_index % não resolve',
        r.e ->> 'unidade_index';
    END IF;
    INSERT INTO modelagem_vendas_unidade (modelagem_id, unidade_id, mes_venda)
    VALUES (v_id, v_novo, NULLIF(r.e ->> 'mes_venda', '')::int)
    ON CONFLICT (modelagem_id, unidade_id) DO UPDATE SET mes_venda = EXCLUDED.mes_venda;
  END LOOP;

  -- ── 16. Takedowns ─────────────────────────────────────────────────────────
  -- Diff por id, e não por chave natural: o lote TEM identidade própria — dois
  -- lotes da mesma tipologia no mesmo mês são legítimos.
  DELETE FROM modelagem_takedowns
   WHERE modelagem_id = v_id
     AND id <> ALL (SELECT COALESCE((e ->> 'id')::int, -1)
                      FROM jsonb_array_elements(COALESCE(p_payload -> 'takedowns', '[]'::jsonb)) e);

  v_filhos := '{}';
  FOR r IN SELECT e, i FROM jsonb_array_elements(COALESCE(p_payload -> 'takedowns', '[]'::jsonb))
                       WITH ORDINALITY t(e, i) ORDER BY i
  LOOP
    v_novo := v_un[(r.e ->> 'unidade_index')::int + 1];
    -- Mesma regra das alocações. Aqui o descarte silencioso nem era possível:
    -- `unidade_id` é NOT NULL, então a linha derrubaria a transação de qualquer
    -- forma — só que com "violates not-null constraint" em vez de uma mensagem
    -- que diz qual bloco e qual índice.
    IF v_novo IS NULL THEN
      RAISE EXCEPTION 'salvar_modelagem: takedowns — unidade_index % não resolve',
        r.e ->> 'unidade_index';
    END IF;
    -- `fase_id` fica nulo quando o lote não declara fase: o vínculo é OPCIONAL,
    -- e isso não é o mesmo que um índice que não resolve. Um `fase_index`
    -- declarado que não resolve, esse sim, é erro.
    v_pai := CASE WHEN jsonb_typeof(r.e -> 'fase_index') = 'number'
                  THEN v_fa[(r.e ->> 'fase_index')::int + 1] END;
    IF jsonb_typeof(r.e -> 'fase_index') = 'number' AND v_pai IS NULL THEN
      RAISE EXCEPTION 'salvar_modelagem: takedowns — fase_index % não resolve',
        r.e ->> 'fase_index';
    END IF;

    IF NULLIF(r.e ->> 'id', '') IS NOT NULL THEN
      UPDATE modelagem_takedowns SET
        unidade_id     = v_novo,
        fase_id        = v_pai,
        ordem          = COALESCE((r.e ->> 'ordem')::int, ordem),
        mes            = GREATEST(1, COALESCE((r.e ->> 'mes')::int, 1)),
        quantidade     = GREATEST(1, COALESCE((r.e ->> 'quantidade')::int, 1)),
        preco_unitario = COALESCE((r.e ->> 'preco_unitario')::decimal, 0),
        observacao     = COALESCE(r.e ->> 'observacao', '')
      WHERE id = (r.e ->> 'id')::int AND modelagem_id = v_id
      RETURNING id INTO v_novo;
    ELSE
      INSERT INTO modelagem_takedowns (
        modelagem_id, unidade_id, fase_id, ordem, mes, quantidade, preco_unitario, observacao
      ) VALUES (
        v_id, v_novo, v_pai,
        COALESCE((r.e ->> 'ordem')::int, 0),
        GREATEST(1, COALESCE((r.e ->> 'mes')::int, 1)),
        GREATEST(1, COALESCE((r.e ->> 'quantidade')::int, 1)),
        COALESCE((r.e ->> 'preco_unitario')::decimal, 0),
        COALESCE(r.e ->> 'observacao', '')
      ) RETURNING id INTO v_novo;
    END IF;
    v_filhos := v_filhos || v_novo;
  END LOOP;
  v_out_takedowns := v_filhos;

  -- ── 17. Retorno ───────────────────────────────────────────────────────────
  -- Só o que o cliente precisa carimbar no rascunho: os ids das linhas que
  -- foram enviadas sem id. Alinhamento POR ÍNDICE do array enviado. Os filhos
  -- aninhados voltam por ID DO PAI, e não por índice: o pai pode ser novo, e aí
  -- o índice não identifica nada que o cliente já conheça.
  RETURN jsonb_build_object(
    'id',               v_id,
    'unidades',         to_jsonb(v_un),
    'custos',           to_jsonb(v_cu),
    'custo_parcelas',   v_cu_par,
    'socios',           to_jsonb(v_so),
    'socio_aportes',    v_so_ap,
    'fases',            to_jsonb(v_fa),
    'facilidades',      to_jsonb(v_fac),
    'aporte_parcelas',  to_jsonb(v_out_aporte_parcelas),
    'opex',             to_jsonb(v_out_opex),
    'takedowns',        to_jsonb(v_out_takedowns)
  );
END;
$$;

COMMENT ON FUNCTION public.salvar_modelagem(jsonb) IS
  'Salva uma modelagem inteira (18 tabelas) numa transacao so, a partir de um '
  'payload jsonb com os filhos aninhados no pai. Substitui as ~118 requisicoes '
  'que o salvar() do editor faz pelo execute-sql. Diff por id nas listas com '
  'identidade, chave natural nas demais; duas passadas em '
  'modelagem_financiamento por causa da FK auto-referencial '
  'refinancia_facilidade_id. Devolve os ids das linhas criadas, alinhados por '
  'indice do array enviado. SECURITY DEFINER porque as tabelas modelagem_* tem '
  'RLS sem policy; exige app_metadata.status = aprovado, em paridade com o gate '
  'do execute-sql.';

-- Fechada para anon e para PUBLIC. Só `authenticated` executa — e mesmo ele
-- passa pelo gate de aprovação lá dentro. `service_role` NÃO entra: ele já é
-- BYPASSRLS e não chega por esta porta; um GRANT a mais é superfície a mais.
REVOKE ALL ON FUNCTION public.salvar_modelagem(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_modelagem(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.salvar_modelagem(jsonb) TO authenticated;
