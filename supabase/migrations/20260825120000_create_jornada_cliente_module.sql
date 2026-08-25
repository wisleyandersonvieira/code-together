-- Módulo Operação > Jornada do Cliente
--
-- Estrutura:
--   jornada_etapas      → catálogo configurável de etapas (Operação > Etapas da Jornada)
--   jornadas            → uma jornada por entidade (cliente, empresa ou grupo)
--   jornada_etapa_itens → o andamento de cada etapa dentro de uma jornada
--
-- Idempotente: pode ser reaplicada sem efeito colateral.

CREATE TABLE IF NOT EXISTS jornada_etapas (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 1 CHECK (ordem >= 1),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS jornada_etapas_nome_key
  ON jornada_etapas (LOWER(nome));

CREATE INDEX IF NOT EXISTS jornada_etapas_ordem_idx
  ON jornada_etapas (ordem, id);

CREATE TABLE IF NOT EXISTS jornadas (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('cliente', 'empresa', 'grupo')),
  entity_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA')),
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao DATE,
  responsavel_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  observacoes TEXT,
  etapa_atual_id BIGINT REFERENCES jornada_etapas(id) ON DELETE SET NULL,
  total_etapas INTEGER NOT NULL DEFAULT 0,
  etapas_concluidas INTEGER NOT NULL DEFAULT 0,
  progresso NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS jornadas_entity_key
  ON jornadas (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS jornadas_status_idx
  ON jornadas (status);

CREATE INDEX IF NOT EXISTS jornadas_etapa_atual_idx
  ON jornadas (etapa_atual_id);

CREATE TABLE IF NOT EXISTS jornada_etapa_itens (
  id BIGSERIAL PRIMARY KEY,
  jornada_id BIGINT NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  etapa_id BIGINT NOT NULL REFERENCES jornada_etapas(id) ON DELETE RESTRICT,
  ordem INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'NAO_APLICAVEL')),
  data_prevista DATE,
  data_inicio DATE,
  data_conclusao DATE,
  responsavel_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT jornada_etapa_itens_jornada_etapa_key UNIQUE (jornada_id, etapa_id)
);

CREATE INDEX IF NOT EXISTS jornada_etapa_itens_jornada_idx
  ON jornada_etapa_itens (jornada_id, ordem);

CREATE INDEX IF NOT EXISTS jornada_etapa_itens_status_idx
  ON jornada_etapa_itens (status);

-- ─── Gatilhos utilitários ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_jornada_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jornada_etapas_set_updated_at ON jornada_etapas;
CREATE TRIGGER jornada_etapas_set_updated_at
  BEFORE UPDATE ON jornada_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

DROP TRIGGER IF EXISTS jornadas_set_updated_at ON jornadas;
CREATE TRIGGER jornadas_set_updated_at
  BEFORE UPDATE ON jornadas
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

DROP TRIGGER IF EXISTS jornada_etapa_itens_set_updated_at ON jornada_etapa_itens;
CREATE TRIGGER jornada_etapa_itens_set_updated_at
  BEFORE UPDATE ON jornada_etapa_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

-- ─── Recálculo do progresso da jornada ───────────────────────────────────────
--
-- total_etapas ignora etapas marcadas como "não aplicável" para que elas não
-- puxem o percentual para baixo. A etapa atual é a primeira em andamento e, na
-- falta dela, a primeira pendente.

CREATE OR REPLACE FUNCTION public.recalc_jornada(p_jornada_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER;
  v_concluidas INTEGER;
  v_etapa_atual BIGINT;
BEGIN
  IF p_jornada_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status <> 'NAO_APLICAVEL'),
    COUNT(*) FILTER (WHERE status = 'CONCLUIDA')
  INTO v_total, v_concluidas
  FROM jornada_etapa_itens
  WHERE jornada_id = p_jornada_id;

  SELECT etapa_id
  INTO v_etapa_atual
  FROM jornada_etapa_itens
  WHERE jornada_id = p_jornada_id
    AND status IN ('EM_ANDAMENTO', 'PENDENTE')
  ORDER BY (status = 'EM_ANDAMENTO') DESC, ordem, id
  LIMIT 1;

  UPDATE jornadas
  SET
    total_etapas = COALESCE(v_total, 0),
    etapas_concluidas = COALESCE(v_concluidas, 0),
    progresso = CASE
      WHEN COALESCE(v_total, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(v_concluidas, 0)::NUMERIC * 100) / v_total, 2)
    END,
    etapa_atual_id = v_etapa_atual,
    updated_at = NOW()
  WHERE id = p_jornada_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_jornada_etapa_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recalc_jornada(COALESCE(NEW.jornada_id, OLD.jornada_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS jornada_etapa_itens_recalc ON jornada_etapa_itens;
CREATE TRIGGER jornada_etapa_itens_recalc
  AFTER INSERT OR UPDATE OR DELETE ON jornada_etapa_itens
  FOR EACH ROW EXECUTE FUNCTION public.handle_jornada_etapa_item_changes();

-- ─── Catálogo de etapas ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_jornada_etapa(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_nome TEXT;
  v_ordem INTEGER;
  v_ativo BOOLEAN;
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;
  v_nome := NULLIF(BTRIM(p_payload->>'nome'), '');
  v_ordem := COALESCE(NULLIF(p_payload->>'ordem', '')::INTEGER, 1);
  v_ativo := COALESCE((p_payload->>'ativo')::BOOLEAN, TRUE);

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da etapa.';
  END IF;

  IF v_ordem < 1 THEN
    v_ordem := 1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jornada_etapas
    WHERE LOWER(nome) = LOWER(v_nome)
      AND (v_id IS NULL OR id <> v_id)
  ) THEN
    RAISE EXCEPTION 'Já existe uma etapa com o nome "%".', v_nome;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO jornada_etapas (nome, descricao, ordem, ativo)
    VALUES (v_nome, NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), ''), v_ordem, v_ativo)
    RETURNING id INTO v_id;
  ELSE
    UPDATE jornada_etapas
    SET
      nome = v_nome,
      descricao = NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), ''),
      ordem = v_ordem,
      ativo = v_ativo
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Etapa não encontrada.';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_jornada_etapa(p_etapa_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_em_uso INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_em_uso
  FROM jornada_etapa_itens
  WHERE etapa_id = p_etapa_id;

  IF COALESCE(v_em_uso, 0) > 0 THEN
    RAISE EXCEPTION 'Esta etapa já é usada em % jornada(s). Inative-a em vez de excluir.', v_em_uso;
  END IF;

  DELETE FROM jornada_etapas WHERE id = p_etapa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  RETURN jsonb_build_object('id', p_etapa_id);
END;
$$;

-- ─── Jornada da entidade ─────────────────────────────────────────────────────
--
-- Salva cabeçalho + etapas em uma única transação. Quando "itens" vem no
-- payload ele é a lista completa: etapas ausentes são removidas da jornada
-- (útil quando uma etapa do catálogo é inativada).

CREATE OR REPLACE FUNCTION public.save_jornada(p_payload JSONB, p_user_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_entity_type TEXT;
  v_entity_id BIGINT;
  v_status TEXT;
  v_data_inicio DATE;
  v_data_conclusao DATE;
  v_item JSONB;
  v_item_status TEXT;
  v_item_data_inicio DATE;
  v_item_data_conclusao DATE;
  v_etapa_ids BIGINT[] := ARRAY[]::BIGINT[];
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;
  v_status := COALESCE(NULLIF(p_payload->>'status', ''), 'ATIVA');
  v_data_inicio := COALESCE(NULLIF(p_payload->>'data_inicio', '')::DATE, CURRENT_DATE);
  v_data_conclusao := NULLIF(p_payload->>'data_conclusao', '')::DATE;

  IF v_status = 'CONCLUIDA' AND v_data_conclusao IS NULL THEN
    v_data_conclusao := CURRENT_DATE;
  ELSIF v_status <> 'CONCLUIDA' THEN
    v_data_conclusao := NULL;
  END IF;

  IF v_id IS NULL THEN
    v_entity_type := NULLIF(p_payload->>'entity_type', '');
    v_entity_id := NULLIF(p_payload->>'entity_id', '')::BIGINT;

    IF v_entity_type IS NULL OR v_entity_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o cliente, empresa ou grupo da jornada.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM jornadas
      WHERE entity_type = v_entity_type AND entity_id = v_entity_id
    ) THEN
      RAISE EXCEPTION 'Já existe uma jornada cadastrada para este registro.';
    END IF;

    INSERT INTO jornadas (
      entity_type, entity_id, status, data_inicio, data_conclusao,
      responsavel_user_id, observacoes, created_by_user_id, updated_by_user_id
    )
    VALUES (
      v_entity_type,
      v_entity_id,
      v_status,
      v_data_inicio,
      v_data_conclusao,
      NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT,
      NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), ''),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE jornadas
    SET
      status = v_status,
      data_inicio = v_data_inicio,
      data_conclusao = v_data_conclusao,
      responsavel_user_id = NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT,
      observacoes = NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), ''),
      updated_by_user_id = COALESCE(p_user_id, updated_by_user_id)
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Jornada não encontrada.';
    END IF;
  END IF;

  IF p_payload ? 'itens' AND jsonb_typeof(p_payload->'itens') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'itens')
    LOOP
      CONTINUE WHEN NULLIF(v_item->>'etapa_id', '') IS NULL;

      v_item_status := COALESCE(NULLIF(v_item->>'status', ''), 'PENDENTE');
      v_item_data_inicio := NULLIF(v_item->>'data_inicio', '')::DATE;
      v_item_data_conclusao := NULLIF(v_item->>'data_conclusao', '')::DATE;

      -- Datas seguem o status: conclui sem data preenchida = concluída hoje.
      IF v_item_status = 'CONCLUIDA' THEN
        v_item_data_conclusao := COALESCE(v_item_data_conclusao, CURRENT_DATE);
        v_item_data_inicio := COALESCE(v_item_data_inicio, v_item_data_conclusao);
      ELSIF v_item_status = 'EM_ANDAMENTO' THEN
        v_item_data_inicio := COALESCE(v_item_data_inicio, CURRENT_DATE);
        v_item_data_conclusao := NULL;
      ELSE
        v_item_data_conclusao := NULL;
      END IF;

      v_etapa_ids := v_etapa_ids || (v_item->>'etapa_id')::BIGINT;

      INSERT INTO jornada_etapa_itens (
        jornada_id, etapa_id, ordem, status, data_prevista, data_inicio,
        data_conclusao, responsavel_user_id, observacoes
      )
      VALUES (
        v_id,
        (v_item->>'etapa_id')::BIGINT,
        COALESCE(NULLIF(v_item->>'ordem', '')::INTEGER, 1),
        v_item_status,
        NULLIF(v_item->>'data_prevista', '')::DATE,
        v_item_data_inicio,
        v_item_data_conclusao,
        NULLIF(v_item->>'responsavel_user_id', '')::BIGINT,
        NULLIF(BTRIM(COALESCE(v_item->>'observacoes', '')), '')
      )
      ON CONFLICT (jornada_id, etapa_id) DO UPDATE
      SET
        ordem = EXCLUDED.ordem,
        status = EXCLUDED.status,
        data_prevista = EXCLUDED.data_prevista,
        data_inicio = EXCLUDED.data_inicio,
        data_conclusao = EXCLUDED.data_conclusao,
        responsavel_user_id = EXCLUDED.responsavel_user_id,
        observacoes = EXCLUDED.observacoes,
        updated_at = NOW();
    END LOOP;

    DELETE FROM jornada_etapa_itens
    WHERE jornada_id = v_id
      AND NOT (etapa_id = ANY(v_etapa_ids));
  END IF;

  PERFORM public.recalc_jornada(v_id);

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_jornada(p_jornada_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM jornadas WHERE id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada não encontrada.';
  END IF;

  RETURN jsonb_build_object('id', p_jornada_id);
END;
$$;

-- ─── Etapas padrão (apenas quando o catálogo está vazio) ─────────────────────

INSERT INTO jornada_etapas (nome, descricao, ordem, ativo)
SELECT * FROM (
  VALUES
    ('Prospecção', 'Primeiro contato e qualificação do cliente.', 1, TRUE),
    ('Proposta', 'Envio e negociação da proposta comercial.', 2, TRUE),
    ('Contrato', 'Assinatura do contrato e formalização.', 3, TRUE),
    ('Onboarding', 'Coleta de documentos e configuração inicial.', 4, TRUE),
    ('Execução', 'Acompanhamento dos projetos em andamento.', 5, TRUE),
    ('Pós-venda', 'Relacionamento, renovação e novas oportunidades.', 6, TRUE)
) AS defaults(nome, descricao, ordem, ativo)
WHERE NOT EXISTS (SELECT 1 FROM jornada_etapas);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
--
-- Mesmo padrão da migration 1760200000: RLS ativo e sem policy fecha o
-- PostgREST para anon/authenticated. O app usa o role app_executor (BYPASSRLS)
-- através da edge function execute-sql.

ALTER TABLE public.jornada_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_etapa_itens ENABLE ROW LEVEL SECURITY;
