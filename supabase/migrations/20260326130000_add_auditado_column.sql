-- Add auditado boolean column to auditoria_fornecedor_itens
ALTER TABLE public.auditoria_fornecedor_itens
  ADD COLUMN IF NOT EXISTS auditado boolean DEFAULT false;

-- Update save_auditoria_fornecedor to handle the new auditado field
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
        IF (SELECT COUNT(*) FROM auditoria_fornecedor_item_parcelas WHERE auditoria_item_id = v_item_id) > v_item_parcelas THEN
          RAISE EXCEPTION 'Não é permitido reduzir a quantidade de parcelas de um item com pagamento registrado.';
        END IF;
      END IF;

      UPDATE auditoria_fornecedor_itens
      SET
        fornecedor_subcontratado_id = (v_item->>'fornecedor_subcontratado_id')::BIGINT,
        data_emissao = NULLIF(v_item->>'data_emissao', '')::DATE,
        valor_total = v_item_valor,
        parcelas = v_item_parcelas,
        projeto_id = NULLIF(v_item->>'projeto_id', '')::BIGINT,
        observacoes = NULLIF(v_item->>'observacoes', ''),
        auditado = COALESCE((v_item->>'auditado')::boolean, false)
      WHERE id = v_item_id;
    ELSE
      INSERT INTO auditoria_fornecedor_itens (
        auditoria_id,
        fornecedor_subcontratado_id,
        data_emissao,
        valor_total,
        parcelas,
        projeto_id,
        observacoes,
        auditado
      )
      VALUES (
        v_auditoria_id,
        (v_item->>'fornecedor_subcontratado_id')::BIGINT,
        NULLIF(v_item->>'data_emissao', '')::DATE,
        v_item_valor,
        v_item_parcelas,
        NULLIF(v_item->>'projeto_id', '')::BIGINT,
        NULLIF(v_item->>'observacoes', ''),
        COALESCE((v_item->>'auditado')::boolean, false)
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
