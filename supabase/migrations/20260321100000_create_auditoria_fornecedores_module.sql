CREATE TABLE IF NOT EXISTS fornecedores_subcontratados (
  id BIGSERIAL PRIMARY KEY,
  nome_razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  contato_responsavel TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_subcontratados_cpf_cnpj_key
  ON fornecedores_subcontratados (cpf_cnpj);

CREATE INDEX IF NOT EXISTS fornecedores_subcontratados_nome_idx
  ON fornecedores_subcontratados (nome_razao_social);

CREATE INDEX IF NOT EXISTS fornecedores_subcontratados_status_idx
  ON fornecedores_subcontratados (status);

CREATE TABLE IF NOT EXISTS auditorias_fornecedores (
  id BIGSERIAL PRIMARY KEY,
  data_auditoria DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'PARCIALMENTE_PAGA', 'QUITADA')),
  quantidade_itens INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_a_pagar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditorias_fornecedores_data_idx
  ON auditorias_fornecedores (data_auditoria DESC);

CREATE INDEX IF NOT EXISTS auditorias_fornecedores_status_idx
  ON auditorias_fornecedores (status);

CREATE TABLE IF NOT EXISTS auditoria_fornecedor_itens (
  id BIGSERIAL PRIMARY KEY,
  auditoria_id BIGINT NOT NULL REFERENCES auditorias_fornecedores(id) ON DELETE CASCADE,
  fornecedor_subcontratado_id BIGINT NOT NULL REFERENCES fornecedores_subcontratados(id) ON DELETE RESTRICT,
  data_emissao DATE,
  valor_total NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  parcelas INTEGER NOT NULL DEFAULT 1 CHECK (parcelas >= 1),
  projeto_id BIGINT REFERENCES projetos(id) ON DELETE RESTRICT,
  status_pagamento TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status_pagamento IN ('PENDENTE', 'PARCIAL', 'PAGO')),
  valor_pago NUMERIC(14, 2) NOT NULL DEFAULT 0,
  valor_a_pagar NUMERIC(14, 2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_itens_auditoria_idx
  ON auditoria_fornecedor_itens (auditoria_id);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_itens_fornecedor_idx
  ON auditoria_fornecedor_itens (fornecedor_subcontratado_id);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_itens_projeto_idx
  ON auditoria_fornecedor_itens (projeto_id);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_itens_status_idx
  ON auditoria_fornecedor_itens (status_pagamento);

CREATE TABLE IF NOT EXISTS auditoria_fornecedor_item_parcelas (
  id BIGSERIAL PRIMARY KEY,
  auditoria_item_id BIGINT NOT NULL REFERENCES auditoria_fornecedor_itens(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL CHECK (numero_parcela >= 1),
  valor_parcela NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_parcela >= 0),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
  data_pagamento DATE,
  data_registro_baixa TIMESTAMPTZ,
  usuario_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auditoria_fornecedor_item_parcelas_status_data_pagamento_chk CHECK (
    (status = 'PENDENTE' AND data_pagamento IS NULL)
    OR (status = 'PAGO' AND data_pagamento IS NOT NULL)
  ),
  CONSTRAINT auditoria_fornecedor_item_parcelas_item_numero_key UNIQUE (auditoria_item_id, numero_parcela)
);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_item_parcelas_item_idx
  ON auditoria_fornecedor_item_parcelas (auditoria_item_id);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_item_parcelas_status_idx
  ON auditoria_fornecedor_item_parcelas (status);

CREATE TABLE IF NOT EXISTS auditoria_fornecedor_historico_pagamentos (
  id BIGSERIAL PRIMARY KEY,
  auditoria_item_id BIGINT NOT NULL REFERENCES auditoria_fornecedor_itens(id) ON DELETE CASCADE,
  auditoria_item_parcela_id BIGINT REFERENCES auditoria_fornecedor_item_parcelas(id) ON DELETE SET NULL,
  numero_parcela INTEGER NOT NULL CHECK (numero_parcela >= 1),
  valor_pago NUMERIC(14, 2) NOT NULL CHECK (valor_pago >= 0),
  status TEXT NOT NULL DEFAULT 'PAGO' CHECK (status IN ('PAGO')),
  data_pagamento DATE NOT NULL,
  usuario_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_fornecedor_historico_item_idx
  ON auditoria_fornecedor_historico_pagamentos (auditoria_item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_auditoria_fornecedor_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_auditoria_fornecedor_item(p_item_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC(14, 2);
  v_pago NUMERIC(14, 2);
  v_total_parcelas INTEGER;
  v_pag_parcelas INTEGER;
BEGIN
  IF p_item_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    i.valor_total,
    COALESCE(SUM(CASE WHEN p.status = 'PAGO' THEN p.valor_parcela ELSE 0 END), 0),
    COUNT(p.id),
    COUNT(*) FILTER (WHERE p.status = 'PAGO')
  INTO v_total, v_pago, v_total_parcelas, v_pag_parcelas
  FROM auditoria_fornecedor_itens i
  LEFT JOIN auditoria_fornecedor_item_parcelas p ON p.auditoria_item_id = i.id
  WHERE i.id = p_item_id
  GROUP BY i.id, i.valor_total;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE auditoria_fornecedor_itens
  SET
    valor_pago = COALESCE(v_pago, 0),
    valor_a_pagar = GREATEST(COALESCE(v_total, 0) - COALESCE(v_pago, 0), 0),
    status_pagamento = CASE
      WHEN COALESCE(v_pag_parcelas, 0) = 0 THEN 'PENDENTE'
      WHEN COALESCE(v_pag_parcelas, 0) >= COALESCE(v_total_parcelas, 0) AND COALESCE(v_total_parcelas, 0) > 0 THEN 'PAGO'
      ELSE 'PARCIAL'
    END,
    updated_at = NOW()
  WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_auditoria_fornecedor(p_auditoria_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC(14, 2);
  v_pago NUMERIC(14, 2);
  v_quantidade_itens INTEGER;
  v_pendentes INTEGER;
  v_pagos INTEGER;
BEGIN
  IF p_auditoria_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(valor_total), 0),
    COALESCE(SUM(valor_pago), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status_pagamento = 'PENDENTE'),
    COUNT(*) FILTER (WHERE status_pagamento = 'PAGO')
  INTO v_total, v_pago, v_quantidade_itens, v_pendentes, v_pagos
  FROM auditoria_fornecedor_itens
  WHERE auditoria_id = p_auditoria_id;

  UPDATE auditorias_fornecedores
  SET
    quantidade_itens = COALESCE(v_quantidade_itens, 0),
    valor_total = COALESCE(v_total, 0),
    valor_pago = COALESCE(v_pago, 0),
    valor_a_pagar = GREATEST(COALESCE(v_total, 0) - COALESCE(v_pago, 0), 0),
    status = CASE
      WHEN COALESCE(v_quantidade_itens, 0) = 0 THEN 'ABERTA'
      WHEN COALESCE(v_pagos, 0) = COALESCE(v_quantidade_itens, 0) AND COALESCE(v_quantidade_itens, 0) > 0 THEN 'QUITADA'
      WHEN COALESCE(v_pendentes, 0) = COALESCE(v_quantidade_itens, 0) THEN 'ABERTA'
      ELSE 'PARCIALMENTE_PAGA'
    END,
    updated_at = NOW()
  WHERE id = p_auditoria_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_auditoria_fornecedor_parcelas_total(p_item_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_total NUMERIC(14, 2);
  v_parcelas_total NUMERIC(14, 2);
  v_quantidade_parcelas INTEGER;
  v_quantidade_esperada INTEGER;
BEGIN
  SELECT valor_total, parcelas INTO v_item_total, v_quantidade_esperada
  FROM auditoria_fornecedor_itens
  WHERE id = p_item_id;

  SELECT COALESCE(SUM(valor_parcela), 0), COUNT(*)
  INTO v_parcelas_total, v_quantidade_parcelas
  FROM auditoria_fornecedor_item_parcelas
  WHERE auditoria_item_id = p_item_id;

  IF COALESCE(v_quantidade_parcelas, 0) > COALESCE(v_quantidade_esperada, 0) THEN
    RAISE EXCEPTION 'A quantidade de parcelas excede o total informado para o item.';
  END IF;

  IF COALESCE(v_quantidade_parcelas, 0) <> COALESCE(v_quantidade_esperada, 0) THEN
    RETURN;
  END IF;

  IF ROUND(COALESCE(v_item_total, 0), 2) <> ROUND(COALESCE(v_parcelas_total, 0), 2) THEN
    RAISE EXCEPTION 'A soma das parcelas deve ser igual ao valor total do item.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auditoria_fornecedor_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.recalc_auditoria_fornecedor(COALESCE(NEW.auditoria_id, OLD.auditoria_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auditoria_fornecedor_parcela_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id BIGINT;
BEGIN
  v_item_id := COALESCE(NEW.auditoria_item_id, OLD.auditoria_item_id);
  PERFORM public.sync_auditoria_fornecedor_parcelas_total(v_item_id);
  PERFORM public.recalc_auditoria_fornecedor_item(v_item_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS fornecedores_subcontratados_set_updated_at ON fornecedores_subcontratados;
CREATE TRIGGER fornecedores_subcontratados_set_updated_at
BEFORE UPDATE ON fornecedores_subcontratados
FOR EACH ROW
EXECUTE FUNCTION public.set_auditoria_fornecedor_updated_at();

DROP TRIGGER IF EXISTS auditorias_fornecedores_set_updated_at ON auditorias_fornecedores;
CREATE TRIGGER auditorias_fornecedores_set_updated_at
BEFORE UPDATE ON auditorias_fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.set_auditoria_fornecedor_updated_at();

DROP TRIGGER IF EXISTS auditoria_fornecedor_itens_set_updated_at ON auditoria_fornecedor_itens;
CREATE TRIGGER auditoria_fornecedor_itens_set_updated_at
BEFORE UPDATE ON auditoria_fornecedor_itens
FOR EACH ROW
EXECUTE FUNCTION public.set_auditoria_fornecedor_updated_at();

DROP TRIGGER IF EXISTS auditoria_fornecedor_item_parcelas_set_updated_at ON auditoria_fornecedor_item_parcelas;
CREATE TRIGGER auditoria_fornecedor_item_parcelas_set_updated_at
BEFORE UPDATE ON auditoria_fornecedor_item_parcelas
FOR EACH ROW
EXECUTE FUNCTION public.set_auditoria_fornecedor_updated_at();

DROP TRIGGER IF EXISTS auditoria_fornecedor_itens_after_change ON auditoria_fornecedor_itens;
CREATE TRIGGER auditoria_fornecedor_itens_after_change
AFTER INSERT OR UPDATE OR DELETE ON auditoria_fornecedor_itens
FOR EACH ROW
EXECUTE FUNCTION public.handle_auditoria_fornecedor_item_changes();

DROP TRIGGER IF EXISTS auditoria_fornecedor_parcelas_after_change ON auditoria_fornecedor_item_parcelas;
CREATE TRIGGER auditoria_fornecedor_parcelas_after_change
AFTER INSERT OR UPDATE OR DELETE ON auditoria_fornecedor_item_parcelas
FOR EACH ROW
EXECUTE FUNCTION public.handle_auditoria_fornecedor_parcela_changes();

CREATE OR REPLACE FUNCTION public.save_auditoria_fornecedor(
  p_payload JSONB,
  p_user_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_auditoria_id BIGINT;
  v_item JSONB;
  v_parcela JSONB;
  v_item_id BIGINT;
  v_existing_auditoria_id BIGINT;
  v_existing_paid_total NUMERIC(14, 2);
  v_existing_paid_count INTEGER;
  v_deleted_item RECORD;
  v_existing_parcela RECORD;
  v_payload_item_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_payload_parcela_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_item_mappings JSONB := '[]'::JSONB;
  v_parcela_id BIGINT;
  v_item_valor NUMERIC(14, 2);
  v_item_parcelas INTEGER;
  v_valor_total_parcelas NUMERIC(14, 2);
BEGIN
  IF COALESCE(jsonb_typeof(p_payload->'items'), '') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'A auditoria deve possuir pelo menos um item.';
  END IF;

  IF COALESCE((p_payload->>'auditoria_id')::BIGINT, 0) > 0 THEN
    v_auditoria_id := (p_payload->>'auditoria_id')::BIGINT;

    UPDATE auditorias_fornecedores
    SET
      data_auditoria = (p_payload->>'data_auditoria')::DATE,
      updated_by_user_id = COALESCE(p_user_id, updated_by_user_id),
      updated_at = NOW()
    WHERE id = v_auditoria_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Auditoria não encontrada.';
    END IF;
  ELSE
    INSERT INTO auditorias_fornecedores (
      data_auditoria,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES (
      (p_payload->>'data_auditoria')::DATE,
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_auditoria_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    v_item_valor := ROUND(COALESCE((v_item->>'valor_total')::NUMERIC, 0), 2);
    v_item_parcelas := GREATEST(COALESCE((v_item->>'parcelas')::INTEGER, 1), 1);

    IF v_item_valor < 0 THEN
      RAISE EXCEPTION 'O valor total do item não pode ser negativo.';
    END IF;

    IF COALESCE(jsonb_typeof(v_item->'parcelas_detalhes'), '') <> 'array' OR jsonb_array_length(v_item->'parcelas_detalhes') <> v_item_parcelas THEN
      RAISE EXCEPTION 'As parcelas do item estão inconsistentes.';
    END IF;

    SELECT COALESCE(SUM(ROUND((value->>'valor_parcela')::NUMERIC, 2)), 0)
    INTO v_valor_total_parcelas
    FROM jsonb_array_elements(v_item->'parcelas_detalhes');

    IF ROUND(v_valor_total_parcelas, 2) <> ROUND(v_item_valor, 2) THEN
      RAISE EXCEPTION 'A soma das parcelas deve ser igual ao valor total do item.';
    END IF;

    IF COALESCE((v_item->>'id')::BIGINT, 0) > 0 THEN
      v_item_id := (v_item->>'id')::BIGINT;

      SELECT auditoria_id INTO v_existing_auditoria_id
      FROM auditoria_fornecedor_itens
      WHERE id = v_item_id;

      IF v_existing_auditoria_id IS DISTINCT FROM v_auditoria_id THEN
        RAISE EXCEPTION 'Item de auditoria inválido.';
      END IF;

      SELECT
        COALESCE(SUM(valor_parcela) FILTER (WHERE status = 'PAGO'), 0),
        COUNT(*) FILTER (WHERE status = 'PAGO')
      INTO v_existing_paid_total, v_existing_paid_count
      FROM auditoria_fornecedor_item_parcelas
      WHERE auditoria_item_id = v_item_id;

      IF COALESCE(v_existing_paid_total, 0) > v_item_valor THEN
        RAISE EXCEPTION 'O valor pago não pode ultrapassar o valor total do item.';
      END IF;

      IF COALESCE(v_existing_paid_count, 0) > 0 THEN
        IF (SELECT COUNT(*) FROM auditoria_fornecedor_item_parcelas WHERE auditoria_item_id = v_item_id) <> v_item_parcelas THEN
          RAISE EXCEPTION 'Não é permitido alterar a quantidade de parcelas de um item com pagamento registrado.';
        END IF;
      END IF;

      UPDATE auditoria_fornecedor_itens
      SET
        fornecedor_subcontratado_id = (v_item->>'fornecedor_subcontratado_id')::BIGINT,
        data_emissao = NULLIF(v_item->>'data_emissao', '')::DATE,
        valor_total = v_item_valor,
        parcelas = v_item_parcelas,
        projeto_id = NULLIF(v_item->>'projeto_id', '')::BIGINT,
        observacoes = NULLIF(v_item->>'observacoes', '')
      WHERE id = v_item_id;
    ELSE
      INSERT INTO auditoria_fornecedor_itens (
        auditoria_id,
        fornecedor_subcontratado_id,
        data_emissao,
        valor_total,
        parcelas,
        projeto_id,
        observacoes
      )
      VALUES (
        v_auditoria_id,
        (v_item->>'fornecedor_subcontratado_id')::BIGINT,
        NULLIF(v_item->>'data_emissao', '')::DATE,
        v_item_valor,
        v_item_parcelas,
        NULLIF(v_item->>'projeto_id', '')::BIGINT,
        NULLIF(v_item->>'observacoes', '')
      )
      RETURNING id INTO v_item_id;
    END IF;

    v_payload_item_ids := array_append(v_payload_item_ids, v_item_id);
    v_payload_parcela_ids := ARRAY[]::BIGINT[];
    v_item_mappings := v_item_mappings || jsonb_build_array(
      jsonb_build_object(
        'client_key', COALESCE(v_item->>'client_key', v_item_id::TEXT),
        'item_id', v_item_id
      )
    );

    FOR v_parcela IN SELECT * FROM jsonb_array_elements(v_item->'parcelas_detalhes')
    LOOP
      v_parcela_id := NULL;
      v_existing_parcela := NULL;

      IF COALESCE((v_parcela->>'id')::BIGINT, 0) > 0 THEN
        SELECT *
        INTO v_existing_parcela
        FROM auditoria_fornecedor_item_parcelas
        WHERE id = (v_parcela->>'id')::BIGINT
          AND auditoria_item_id = v_item_id;
      ELSE
        SELECT *
        INTO v_existing_parcela
        FROM auditoria_fornecedor_item_parcelas
        WHERE auditoria_item_id = v_item_id
          AND numero_parcela = (v_parcela->>'numero_parcela')::INTEGER;
      END IF;

      IF FOUND THEN
        IF v_existing_parcela.status = 'PAGO' THEN
          IF ROUND(v_existing_parcela.valor_parcela, 2) <> ROUND(COALESCE((v_parcela->>'valor_parcela')::NUMERIC, 0), 2) THEN
            RAISE EXCEPTION 'Não é permitido alterar o valor de uma parcela já paga.';
          END IF;
        ELSE
          UPDATE auditoria_fornecedor_item_parcelas
          SET
            numero_parcela = (v_parcela->>'numero_parcela')::INTEGER,
            valor_parcela = ROUND(COALESCE((v_parcela->>'valor_parcela')::NUMERIC, 0), 2),
            observacao = NULLIF(v_parcela->>'observacao', '')
          WHERE id = v_existing_parcela.id;
        END IF;

        v_parcela_id := v_existing_parcela.id;
      ELSE
        INSERT INTO auditoria_fornecedor_item_parcelas (
          auditoria_item_id,
          numero_parcela,
          valor_parcela,
          status,
          data_pagamento,
          data_registro_baixa,
          usuario_id,
          observacao
        )
        VALUES (
          v_item_id,
          (v_parcela->>'numero_parcela')::INTEGER,
          ROUND(COALESCE((v_parcela->>'valor_parcela')::NUMERIC, 0), 2),
          CASE WHEN COALESCE(v_parcela->>'status', 'PENDENTE') = 'PAGO' THEN 'PAGO' ELSE 'PENDENTE' END,
          CASE
            WHEN COALESCE(v_parcela->>'status', 'PENDENTE') = 'PAGO' THEN NULLIF(v_parcela->>'data_pagamento', '')::DATE
            ELSE NULL
          END,
          CASE
            WHEN COALESCE(v_parcela->>'status', 'PENDENTE') = 'PAGO' THEN NOW()
            ELSE NULL
          END,
          CASE
            WHEN COALESCE(v_parcela->>'status', 'PENDENTE') = 'PAGO' THEN p_user_id
            ELSE NULL
          END,
          NULLIF(v_parcela->>'observacao', '')
        )
        RETURNING id INTO v_parcela_id;
      END IF;

      v_payload_parcela_ids := array_append(v_payload_parcela_ids, v_parcela_id);

      IF COALESCE(v_existing_parcela.status, 'PENDENTE') <> 'PAGO'
         AND COALESCE(v_parcela->>'status', 'PENDENTE') = 'PAGO' THEN
        IF NULLIF(v_parcela->>'data_pagamento', '') IS NULL THEN
          RAISE EXCEPTION 'A data de pagamento é obrigatória para parcelas pagas.';
        END IF;

        UPDATE auditoria_fornecedor_item_parcelas
        SET
          status = 'PAGO',
          data_pagamento = NULLIF(v_parcela->>'data_pagamento', '')::DATE,
          data_registro_baixa = COALESCE(data_registro_baixa, NOW()),
          usuario_id = COALESCE(p_user_id, usuario_id),
          observacao = NULLIF(v_parcela->>'observacao', '')
        WHERE id = v_parcela_id;

        INSERT INTO auditoria_fornecedor_historico_pagamentos (
          auditoria_item_id,
          auditoria_item_parcela_id,
          numero_parcela,
          valor_pago,
          data_pagamento,
          usuario_id,
          observacao
        )
        VALUES (
          v_item_id,
          v_parcela_id,
          (v_parcela->>'numero_parcela')::INTEGER,
          ROUND(COALESCE((v_parcela->>'valor_parcela')::NUMERIC, 0), 2),
          NULLIF(v_parcela->>'data_pagamento', '')::DATE,
          p_user_id,
          NULLIF(v_parcela->>'observacao', '')
        );
      END IF;
    END LOOP;

    FOR v_existing_parcela IN
      SELECT *
      FROM auditoria_fornecedor_item_parcelas
      WHERE auditoria_item_id = v_item_id
        AND NOT (id = ANY(v_payload_parcela_ids))
    LOOP
      IF v_existing_parcela.status = 'PAGO' THEN
        RAISE EXCEPTION 'Não é permitido remover parcelas com pagamento registrado.';
      END IF;

      DELETE FROM auditoria_fornecedor_item_parcelas
      WHERE id = v_existing_parcela.id;
    END LOOP;

    PERFORM public.sync_auditoria_fornecedor_parcelas_total(v_item_id);
    PERFORM public.recalc_auditoria_fornecedor_item(v_item_id);
  END LOOP;

  FOR v_deleted_item IN
    SELECT i.id
    FROM auditoria_fornecedor_itens i
    WHERE i.auditoria_id = v_auditoria_id
      AND NOT (i.id = ANY(v_payload_item_ids))
  LOOP
    SELECT
      COALESCE(SUM(valor_parcela) FILTER (WHERE status = 'PAGO'), 0),
      COUNT(*) FILTER (WHERE status = 'PAGO')
    INTO v_existing_paid_total, v_existing_paid_count
    FROM auditoria_fornecedor_item_parcelas
    WHERE auditoria_item_id = v_deleted_item.id;

    IF COALESCE(v_existing_paid_count, 0) > 0 THEN
      RAISE EXCEPTION 'Não é permitido excluir itens com pagamento registrado.';
    END IF;

    DELETE FROM files
    WHERE entity_type = 'auditoria_item'
      AND entity_id = v_deleted_item.id;

    DELETE FROM auditoria_fornecedor_itens
    WHERE id = v_deleted_item.id;
  END LOOP;

  PERFORM public.recalc_auditoria_fornecedor(v_auditoria_id);

  RETURN jsonb_build_object(
    'auditoria_id', v_auditoria_id,
    'item_mappings', v_item_mappings
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auditoria_fornecedor(p_auditoria_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_paid_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_paid_count
  FROM auditoria_fornecedor_item_parcelas p
  JOIN auditoria_fornecedor_itens i ON i.id = p.auditoria_item_id
  WHERE i.auditoria_id = p_auditoria_id
    AND p.status = 'PAGO';

  IF COALESCE(v_paid_count, 0) > 0 THEN
    RAISE EXCEPTION 'Não é permitido excluir auditorias com pagamentos registrados.';
  END IF;

  DELETE FROM files
  WHERE entity_type = 'auditoria_item'
    AND entity_id IN (
      SELECT id
      FROM auditoria_fornecedor_itens
      WHERE auditoria_id = p_auditoria_id
    );

  DELETE FROM auditorias_fornecedores
  WHERE id = p_auditoria_id;
END;
$$;
