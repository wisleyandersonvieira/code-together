CREATE OR REPLACE FUNCTION public.save_estrutura_dre(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
  v_nome text := trim(coalesce(p_payload->>'nome',''));
  v_item jsonb;
  v_new_id integer;
  v_parent_id integer;
  v_keep integer[] := ARRAY[]::integer[];
BEGIN
  IF v_nome = '' THEN
    RAISE EXCEPTION 'Nome da estrutura é obrigatório';
  END IF;

  v_id := NULLIF(p_payload->>'id','')::integer;

  IF v_id IS NULL THEN
    INSERT INTO estruturas_dre (nome) VALUES (v_nome) RETURNING id INTO v_id;
  ELSE
    UPDATE estruturas_dre SET nome = v_nome, updated_at = CURRENT_TIMESTAMP WHERE id = v_id;
  END IF;

  -- Pass 1: non-subgroup items
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'itens','[]'::jsonb))
  LOOP
    IF (v_item->>'tipo') = 'SUBGRUPO' THEN CONTINUE; END IF;

    IF NULLIF(v_item->>'id','') IS NOT NULL THEN
      UPDATE estruturas_dre_itens SET
        tipo = v_item->>'tipo',
        nome = v_item->>'nome',
        grupo_contabil_id = NULLIF(v_item->>'grupo_contabil_id','')::integer,
        subgrupo_contabil_id = NULLIF(v_item->>'subgrupo_contabil_id','')::integer,
        ordem = (v_item->>'ordem')::numeric,
        nivel = (v_item->>'nivel')::integer,
        parent_id = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (v_item->>'id')::integer
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO estruturas_dre_itens
        (estrutura_dre_id, tipo, nome, grupo_contabil_id, subgrupo_contabil_id, ordem, nivel, parent_id)
      VALUES (
        v_id,
        v_item->>'tipo',
        v_item->>'nome',
        NULLIF(v_item->>'grupo_contabil_id','')::integer,
        NULLIF(v_item->>'subgrupo_contabil_id','')::integer,
        (v_item->>'ordem')::numeric,
        (v_item->>'nivel')::integer,
        NULL
      ) RETURNING id INTO v_new_id;
    END IF;

    IF v_new_id IS NOT NULL THEN
      v_keep := v_keep || v_new_id;
    END IF;
  END LOOP;

  -- Pass 2: subgroups, resolving parent by grupo_contabil_id
  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'itens','[]'::jsonb))
  LOOP
    IF (v_item->>'tipo') <> 'SUBGRUPO' THEN CONTINUE; END IF;

    v_parent_id := NULL;
    IF NULLIF(v_item->>'grupo_contabil_id','') IS NOT NULL THEN
      SELECT id INTO v_parent_id
      FROM estruturas_dre_itens
      WHERE estrutura_dre_id = v_id
        AND tipo = 'GRUPO'
        AND grupo_contabil_id = (v_item->>'grupo_contabil_id')::integer
      ORDER BY ordem
      LIMIT 1;
    END IF;

    IF NULLIF(v_item->>'id','') IS NOT NULL THEN
      UPDATE estruturas_dre_itens SET
        tipo = 'SUBGRUPO',
        nome = v_item->>'nome',
        grupo_contabil_id = NULLIF(v_item->>'grupo_contabil_id','')::integer,
        subgrupo_contabil_id = NULLIF(v_item->>'subgrupo_contabil_id','')::integer,
        ordem = (v_item->>'ordem')::numeric,
        nivel = (v_item->>'nivel')::integer,
        parent_id = v_parent_id,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (v_item->>'id')::integer
      RETURNING id INTO v_new_id;
    ELSE
      INSERT INTO estruturas_dre_itens
        (estrutura_dre_id, tipo, nome, grupo_contabil_id, subgrupo_contabil_id, ordem, nivel, parent_id)
      VALUES (
        v_id,
        'SUBGRUPO',
        v_item->>'nome',
        NULLIF(v_item->>'grupo_contabil_id','')::integer,
        NULLIF(v_item->>'subgrupo_contabil_id','')::integer,
        (v_item->>'ordem')::numeric,
        (v_item->>'nivel')::integer,
        v_parent_id
      ) RETURNING id INTO v_new_id;
    END IF;

    IF v_new_id IS NOT NULL THEN
      v_keep := v_keep || v_new_id;
    END IF;
  END LOOP;

  -- Remove itens que não estão mais na estrutura
  DELETE FROM estruturas_dre_itens
  WHERE estrutura_dre_id = v_id
    AND NOT (id = ANY(v_keep));

  RETURN jsonb_build_object('id', v_id, 'itens', array_length(v_keep, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_estrutura_dre(jsonb) TO authenticated, anon, service_role;