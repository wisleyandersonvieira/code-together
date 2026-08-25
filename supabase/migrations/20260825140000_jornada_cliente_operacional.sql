-- Módulo Operação > Jornada do Cliente — versão operacional
--
-- Transforma o registro passivo em controle de operação:
--   • fluxos por tipo de cliente/serviço, com etapas e checklist modelo
--   • checklist dentro da etapa (bloqueia a conclusão enquanto houver item obrigatório)
--   • estados "aguardando cliente" / "aguardando órgão" que pausam o SLA
--   • prazo automático por etapa, avanço automático e histórico de status
--   • obrigações recorrentes (mensais/anuais) geradas por competência
--   • anexos por etapa (reaproveita a tabela files)
--   • view unificada de tarefas para painel de prazos, caixa do usuário e relatórios
--
-- Idempotente: pode ser reaplicada sem efeito colateral.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FLUXOS — etapas deixam de ser um catálogo global único
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jornada_fluxos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  entity_type TEXT CHECK (entity_type IN ('cliente', 'empresa', 'grupo')),
  avanco_automatico BOOLEAN NOT NULL DEFAULT TRUE,
  padrao BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS jornada_fluxos_nome_key ON jornada_fluxos (LOWER(nome));
-- Só um fluxo pode ser o padrão sugerido na criação da jornada.
CREATE UNIQUE INDEX IF NOT EXISTS jornada_fluxos_padrao_key ON jornada_fluxos (padrao) WHERE padrao;

CREATE TABLE IF NOT EXISTS jornada_fluxo_etapas (
  id BIGSERIAL PRIMARY KEY,
  fluxo_id BIGINT NOT NULL REFERENCES jornada_fluxos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 1 CHECK (ordem >= 1),
  prazo_dias INTEGER CHECK (prazo_dias IS NULL OR prazo_dias >= 0),
  setor TEXT,
  responsavel_padrao_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  legacy_etapa_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jornada_fluxo_etapas_fluxo_idx ON jornada_fluxo_etapas (fluxo_id, ordem, id);
CREATE UNIQUE INDEX IF NOT EXISTS jornada_fluxo_etapas_legacy_key
  ON jornada_fluxo_etapas (legacy_etapa_id) WHERE legacy_etapa_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS jornada_fluxo_checklist (
  id BIGSERIAL PRIMARY KEY,
  fluxo_etapa_id BIGINT NOT NULL REFERENCES jornada_fluxo_etapas(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 1,
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jornada_fluxo_checklist_etapa_idx
  ON jornada_fluxo_checklist (fluxo_etapa_id, ordem, id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. JORNADA — vínculo com fluxo
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS fluxo_id BIGINT REFERENCES jornada_fluxos(id) ON DELETE SET NULL;
ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS etapa_atual_item_id BIGINT;

CREATE INDEX IF NOT EXISTS jornadas_fluxo_idx ON jornadas (fluxo_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ITENS DA JORNADA — SLA, pausa e checklist
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS fluxo_etapa_id BIGINT REFERENCES jornada_fluxo_etapas(id) ON DELETE RESTRICT;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS prazo_dias INTEGER;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS data_limite DATE;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS dias_pausados INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS pausado_em DATE;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS aguardando_motivo TEXT;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS status_desde DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS checklist_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jornada_etapa_itens ADD COLUMN IF NOT EXISTS checklist_concluidos INTEGER NOT NULL DEFAULT 0;

-- A etapa deixa de vir do catálogo global: quem manda agora é fluxo_etapa_id.
ALTER TABLE jornada_etapa_itens ALTER COLUMN etapa_id DROP NOT NULL;
ALTER TABLE jornada_etapa_itens DROP CONSTRAINT IF EXISTS jornada_etapa_itens_jornada_etapa_key;

-- Estados novos: aguardando cliente / aguardando órgão pausam o SLA.
ALTER TABLE jornada_etapa_itens DROP CONSTRAINT IF EXISTS jornada_etapa_itens_status_check;
ALTER TABLE jornada_etapa_itens ADD CONSTRAINT jornada_etapa_itens_status_check
  CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'CONCLUIDA', 'NAO_APLICAVEL'));

CREATE INDEX IF NOT EXISTS jornada_etapa_itens_limite_idx
  ON jornada_etapa_itens (data_limite) WHERE status NOT IN ('CONCLUIDA', 'NAO_APLICAVEL');
CREATE INDEX IF NOT EXISTS jornada_etapa_itens_responsavel_idx
  ON jornada_etapa_itens (responsavel_user_id) WHERE status NOT IN ('CONCLUIDA', 'NAO_APLICAVEL');

CREATE TABLE IF NOT EXISTS jornada_item_checklist (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES jornada_etapa_itens(id) ON DELETE CASCADE,
  fluxo_checklist_id BIGINT REFERENCES jornada_fluxo_checklist(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 1,
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  concluido BOOLEAN NOT NULL DEFAULT FALSE,
  concluido_em TIMESTAMPTZ,
  concluido_por_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jornada_item_checklist_item_idx ON jornada_item_checklist (item_id, ordem, id);
CREATE UNIQUE INDEX IF NOT EXISTS jornada_item_checklist_modelo_key
  ON jornada_item_checklist (item_id, fluxo_checklist_id) WHERE fluxo_checklist_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS jornada_etapa_historico (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES jornada_etapa_itens(id) ON DELETE CASCADE,
  jornada_id BIGINT NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  dias_no_status INTEGER NOT NULL DEFAULT 0,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jornada_etapa_historico_item_idx ON jornada_etapa_historico (item_id, created_at);
CREATE INDEX IF NOT EXISTS jornada_etapa_historico_jornada_idx ON jornada_etapa_historico (jornada_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. OBRIGAÇÕES RECORRENTES — o trabalho infinito que não cabe numa jornada
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Vencimento por regra simples: dia fixo do mês, deslocado N meses a partir do
-- primeiro dia da competência. Dia maior que o último dia do mês é ajustado
-- para o último dia (ex.: dia 31 em fevereiro → 28/29).

CREATE TABLE IF NOT EXISTS obrigacoes_catalogo (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  periodicidade TEXT NOT NULL DEFAULT 'MENSAL'
    CHECK (periodicidade IN ('MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL')),
  -- Mês âncora: em que mês do ano a competência começa a contar. Para MENSAL é
  -- ignorado; para TRIMESTRAL 3 gera 3/6/9/12; para ANUAL 12 gera só dezembro.
  mes_ancora INTEGER CHECK (mes_ancora BETWEEN 1 AND 12),
  dia_vencimento INTEGER NOT NULL DEFAULT 15 CHECK (dia_vencimento BETWEEN 1 AND 31),
  -- Quantos meses depois da competência o prazo vence. 1 = mês seguinte.
  mes_offset INTEGER NOT NULL DEFAULT 1 CHECK (mes_offset >= 0),
  -- Antecedência interna: o escritório se cobra N dias antes do prazo legal.
  prazo_interno_dias INTEGER NOT NULL DEFAULT 0 CHECK (prazo_interno_dias >= 0),
  setor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS obrigacoes_catalogo_nome_key ON obrigacoes_catalogo (LOWER(nome));

CREATE TABLE IF NOT EXISTS obrigacoes_cliente (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('cliente', 'empresa', 'grupo')),
  entity_id BIGINT NOT NULL,
  obrigacao_id BIGINT NOT NULL REFERENCES obrigacoes_catalogo(id) ON DELETE RESTRICT,
  responsavel_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT obrigacoes_cliente_key UNIQUE (entity_type, entity_id, obrigacao_id)
);

CREATE INDEX IF NOT EXISTS obrigacoes_cliente_entidade_idx ON obrigacoes_cliente (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS obrigacoes_cliente_ativo_idx ON obrigacoes_cliente (ativo) WHERE ativo;

CREATE TABLE IF NOT EXISTS obrigacoes_competencias (
  id BIGSERIAL PRIMARY KEY,
  obrigacao_cliente_id BIGINT NOT NULL REFERENCES obrigacoes_cliente(id) ON DELETE CASCADE,
  competencia_ano INTEGER NOT NULL,
  competencia_mes INTEGER NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
  competencia_label TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  data_limite_interna DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE', 'EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'ENTREGUE', 'DISPENSADA')),
  data_entrega DATE,
  protocolo TEXT,
  responsavel_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  observacoes TEXT,
  -- O vencimento legal não se move; a pausa só registra de quem é a culpa.
  dias_pausados INTEGER NOT NULL DEFAULT 0,
  pausado_em DATE,
  aguardando_motivo TEXT,
  status_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT obrigacoes_competencias_key UNIQUE (obrigacao_cliente_id, competencia_ano, competencia_mes)
);

CREATE INDEX IF NOT EXISTS obrigacoes_competencias_venc_idx
  ON obrigacoes_competencias (data_vencimento) WHERE status NOT IN ('ENTREGUE', 'DISPENSADA');
CREATE INDEX IF NOT EXISTS obrigacoes_competencias_responsavel_idx
  ON obrigacoes_competencias (responsavel_user_id) WHERE status NOT IN ('ENTREGUE', 'DISPENSADA');

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. MIGRAÇÃO DOS DADOS EXISTENTES → fluxo "Padrão"
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O catálogo antigo (jornada_etapas) permanece na base intocado, mas sai do ar:
-- as etapas passam a viver dentro do fluxo. Nenhuma jornada existente perde
-- andamento — os itens apenas ganham o vínculo com a etapa do fluxo.
-- prazo_dias fica nulo de propósito: ninguém acorda em atraso por causa desta
-- migration; o prazo é definido em Operação > Fluxos e Etapas.

INSERT INTO jornada_fluxos (nome, descricao, padrao, ativo)
SELECT 'Padrão', 'Fluxo herdado do catálogo de etapas anterior.', TRUE, TRUE
WHERE NOT EXISTS (SELECT 1 FROM jornada_fluxos);

INSERT INTO jornada_fluxo_etapas (fluxo_id, nome, descricao, ordem, ativo, legacy_etapa_id)
SELECT f.id, e.nome, e.descricao, e.ordem, e.ativo, e.id
FROM jornada_etapas e
CROSS JOIN LATERAL (SELECT id FROM jornada_fluxos WHERE padrao = TRUE LIMIT 1) f
WHERE NOT EXISTS (
  SELECT 1 FROM jornada_fluxo_etapas fe WHERE fe.legacy_etapa_id = e.id
);

UPDATE jornada_etapa_itens i
SET fluxo_etapa_id = fe.id
FROM jornada_fluxo_etapas fe
WHERE fe.legacy_etapa_id = i.etapa_id
  AND i.fluxo_etapa_id IS NULL;

UPDATE jornadas
SET fluxo_id = (SELECT id FROM jornada_fluxos WHERE padrao = TRUE LIMIT 1)
WHERE fluxo_id IS NULL;

-- Itens órfãos (etapa do catálogo já removida) não têm como ser migrados.
DELETE FROM jornada_etapa_itens WHERE fluxo_etapa_id IS NULL;

ALTER TABLE jornada_etapa_itens ALTER COLUMN fluxo_etapa_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jornada_etapa_itens_jornada_fluxo_etapa_key
  ON jornada_etapa_itens (jornada_id, fluxo_etapa_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. GATILHOS — SLA que pausa, checklist que trava, prazo que anda sozinho
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS jornada_fluxos_set_updated_at ON jornada_fluxos;
CREATE TRIGGER jornada_fluxos_set_updated_at
  BEFORE UPDATE ON jornada_fluxos
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

DROP TRIGGER IF EXISTS jornada_fluxo_etapas_set_updated_at ON jornada_fluxo_etapas;
CREATE TRIGGER jornada_fluxo_etapas_set_updated_at
  BEFORE UPDATE ON jornada_fluxo_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

DROP TRIGGER IF EXISTS obrigacoes_catalogo_set_updated_at ON obrigacoes_catalogo;
CREATE TRIGGER obrigacoes_catalogo_set_updated_at
  BEFORE UPDATE ON obrigacoes_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

DROP TRIGGER IF EXISTS obrigacoes_cliente_set_updated_at ON obrigacoes_cliente;
CREATE TRIGGER obrigacoes_cliente_set_updated_at
  BEFORE UPDATE ON obrigacoes_cliente
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

DROP TRIGGER IF EXISTS obrigacoes_competencias_set_updated_at ON obrigacoes_competencias;
CREATE TRIGGER obrigacoes_competencias_set_updated_at
  BEFORE UPDATE ON obrigacoes_competencias
  FOR EACH ROW EXECUTE FUNCTION public.set_jornada_updated_at();

-- Progresso da jornada, agora ciente de que "aguardando" ainda é etapa aberta.
CREATE OR REPLACE FUNCTION public.recalc_jornada(p_jornada_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER;
  v_concluidas INTEGER;
  v_item_atual BIGINT;
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

  -- Etapa atual: a que está em andamento; senão a que está travada aguardando
  -- terceiros; senão a próxima pendente.
  SELECT id, etapa_id
  INTO v_item_atual, v_etapa_atual
  FROM jornada_etapa_itens
  WHERE jornada_id = p_jornada_id
    AND status IN ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'PENDENTE')
  ORDER BY
    CASE status
      WHEN 'EM_ANDAMENTO' THEN 1
      WHEN 'AGUARDANDO_CLIENTE' THEN 2
      WHEN 'AGUARDANDO_ORGAO' THEN 2
      ELSE 3
    END,
    ordem, id
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
    etapa_atual_item_id = v_item_atual,
    updated_at = NOW()
  WHERE id = p_jornada_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.jornada_item_before_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pendentes INTEGER;
  v_dias INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'CONCLUIDA')
       AND NEW.data_inicio IS NULL THEN
      NEW.data_inicio := CURRENT_DATE;
    END IF;

    IF NEW.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO') THEN
      NEW.pausado_em := CURRENT_DATE;
    END IF;

    IF NEW.status = 'CONCLUIDA' THEN
      NEW.data_conclusao := COALESCE(NEW.data_conclusao, CURRENT_DATE);
    END IF;

  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Checklist obrigatório em aberto impede fechar a etapa.
    IF NEW.status = 'CONCLUIDA' THEN
      SELECT COUNT(*) INTO v_pendentes
      FROM jornada_item_checklist
      WHERE item_id = NEW.id AND obrigatorio = TRUE AND concluido = FALSE;

      IF COALESCE(v_pendentes, 0) > 0 THEN
        RAISE EXCEPTION 'Conclua os % item(ns) obrigatório(s) do checklist antes de finalizar a etapa.', v_pendentes;
      END IF;
    END IF;

    -- Entrou em espera: o relógio do SLA congela.
    IF NEW.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')
       AND OLD.status NOT IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO') THEN
      NEW.pausado_em := CURRENT_DATE;
    END IF;

    -- Saiu da espera: o tempo parado volta como folga de prazo.
    IF OLD.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')
       AND NEW.status NOT IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO') THEN
      v_dias := GREATEST(CURRENT_DATE - COALESCE(OLD.pausado_em, CURRENT_DATE), 0);
      NEW.dias_pausados := COALESCE(OLD.dias_pausados, 0) + v_dias;
      NEW.pausado_em := NULL;
      NEW.aguardando_motivo := NULL;
    END IF;

    NEW.status_desde := CURRENT_DATE;

    IF NEW.status IN ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'CONCLUIDA')
       AND NEW.data_inicio IS NULL THEN
      NEW.data_inicio := CURRENT_DATE;
    END IF;

    IF NEW.status = 'CONCLUIDA' THEN
      NEW.data_conclusao := COALESCE(NEW.data_conclusao, CURRENT_DATE);
    ELSE
      NEW.data_conclusao := NULL;
    END IF;
  END IF;

  -- Data limite: previsão preenchida à mão vence a regra do fluxo.
  IF NEW.data_prevista IS NOT NULL THEN
    NEW.data_limite := NEW.data_prevista;
  ELSIF NEW.prazo_dias IS NOT NULL AND NEW.data_inicio IS NOT NULL THEN
    NEW.data_limite := NEW.data_inicio + NEW.prazo_dias + COALESCE(NEW.dias_pausados, 0);
  ELSE
    NEW.data_limite := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jornada_etapa_itens_before_change ON jornada_etapa_itens;
CREATE TRIGGER jornada_etapa_itens_before_change
  BEFORE INSERT OR UPDATE ON jornada_etapa_itens
  FOR EACH ROW EXECUTE FUNCTION public.jornada_item_before_change();

CREATE OR REPLACE FUNCTION public.jornada_item_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user BIGINT;
  v_proximo BIGINT;
  v_auto BOOLEAN;
BEGIN
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    v_user := NULLIF(current_setting('app.jornada_user_id', TRUE), '')::BIGINT;

    INSERT INTO jornada_etapa_historico (
      item_id, jornada_id, status_anterior, status_novo, dias_no_status, user_id, observacao
    )
    VALUES (
      NEW.id,
      NEW.jornada_id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
      NEW.status,
      CASE WHEN TG_OP = 'UPDATE' THEN GREATEST(CURRENT_DATE - OLD.status_desde, 0) ELSE 0 END,
      v_user,
      NEW.aguardando_motivo
    );

    -- Prazo que cobra sozinho: fechou a etapa, a próxima já nasce em andamento
    -- com o relógio rodando.
    IF NEW.status = 'CONCLUIDA' THEN
      SELECT f.avanco_automatico INTO v_auto
      FROM jornadas j
      JOIN jornada_fluxos f ON f.id = j.fluxo_id
      WHERE j.id = NEW.jornada_id;

      IF COALESCE(v_auto, FALSE) THEN
        SELECT i.id INTO v_proximo
        FROM jornada_etapa_itens i
        WHERE i.jornada_id = NEW.jornada_id
          AND i.status = 'PENDENTE'
        ORDER BY i.ordem, i.id
        LIMIT 1;

        IF v_proximo IS NOT NULL THEN
          UPDATE jornada_etapa_itens SET status = 'EM_ANDAMENTO' WHERE id = v_proximo;
        END IF;
      END IF;
    END IF;
  END IF;

  PERFORM public.recalc_jornada(COALESCE(NEW.jornada_id, OLD.jornada_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS jornada_etapa_itens_recalc ON jornada_etapa_itens;
CREATE TRIGGER jornada_etapa_itens_recalc
  AFTER INSERT OR UPDATE OR DELETE ON jornada_etapa_itens
  FOR EACH ROW EXECUTE FUNCTION public.jornada_item_after_change();

-- Contadores do checklist ficam prontos na linha da etapa, sem subconsulta na
-- listagem.
CREATE OR REPLACE FUNCTION public.recalc_item_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_item BIGINT := COALESCE(NEW.item_id, OLD.item_id);
BEGIN
  UPDATE jornada_etapa_itens i
  SET
    checklist_total = COALESCE(c.total, 0),
    checklist_concluidos = COALESCE(c.feitos, 0)
  FROM (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE concluido) AS feitos
    FROM jornada_item_checklist
    WHERE item_id = v_item
  ) c
  WHERE i.id = v_item;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS jornada_item_checklist_recalc ON jornada_item_checklist;
CREATE TRIGGER jornada_item_checklist_recalc
  AFTER INSERT OR UPDATE OR DELETE ON jornada_item_checklist
  FOR EACH ROW EXECUTE FUNCTION public.recalc_item_checklist();

-- Competências: mesma contabilidade de pausa, mas o vencimento legal não anda.
CREATE OR REPLACE FUNCTION public.obrigacao_competencia_before_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_dias INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')
       AND OLD.status NOT IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO') THEN
      NEW.pausado_em := CURRENT_DATE;
    END IF;

    IF OLD.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')
       AND NEW.status NOT IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO') THEN
      v_dias := GREATEST(CURRENT_DATE - COALESCE(OLD.pausado_em, CURRENT_DATE), 0);
      NEW.dias_pausados := COALESCE(OLD.dias_pausados, 0) + v_dias;
      NEW.pausado_em := NULL;
      NEW.aguardando_motivo := NULL;
    END IF;

    NEW.status_desde := CURRENT_DATE;

    IF NEW.status = 'ENTREGUE' THEN
      NEW.data_entrega := COALESCE(NEW.data_entrega, CURRENT_DATE);
    ELSIF NEW.status <> 'DISPENSADA' THEN
      NEW.data_entrega := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS obrigacoes_competencias_before_change ON obrigacoes_competencias;
CREATE TRIGGER obrigacoes_competencias_before_change
  BEFORE INSERT OR UPDATE ON obrigacoes_competencias
  FOR EACH ROW EXECUTE FUNCTION public.obrigacao_competencia_before_change();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. FLUXOS — cadastro do modelo (etapas + checklist) em uma transação
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_jornada_fluxo(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_nome TEXT;
  v_padrao BOOLEAN;
  v_etapa JSONB;
  v_check JSONB;
  v_etapa_id BIGINT;
  v_etapa_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_check_ids BIGINT[];
  v_check_id BIGINT;
  v_em_uso INTEGER;
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;
  v_nome := NULLIF(BTRIM(p_payload->>'nome'), '');
  v_padrao := COALESCE((p_payload->>'padrao')::BOOLEAN, FALSE);

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do fluxo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jornada_fluxos
    WHERE LOWER(nome) = LOWER(v_nome) AND (v_id IS NULL OR id <> v_id)
  ) THEN
    RAISE EXCEPTION 'Já existe um fluxo com o nome "%".', v_nome;
  END IF;

  -- O índice parcial só admite um padrão: derruba o anterior antes de gravar.
  IF v_padrao THEN
    UPDATE jornada_fluxos SET padrao = FALSE
    WHERE padrao = TRUE AND (v_id IS NULL OR id <> v_id);
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO jornada_fluxos (nome, descricao, entity_type, avanco_automatico, padrao, ativo)
    VALUES (
      v_nome,
      NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), ''),
      NULLIF(p_payload->>'entity_type', ''),
      COALESCE((p_payload->>'avanco_automatico')::BOOLEAN, TRUE),
      v_padrao,
      COALESCE((p_payload->>'ativo')::BOOLEAN, TRUE)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE jornada_fluxos
    SET
      nome = v_nome,
      descricao = NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), ''),
      entity_type = NULLIF(p_payload->>'entity_type', ''),
      avanco_automatico = COALESCE((p_payload->>'avanco_automatico')::BOOLEAN, TRUE),
      padrao = v_padrao,
      ativo = COALESCE((p_payload->>'ativo')::BOOLEAN, TRUE)
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fluxo não encontrado.';
    END IF;
  END IF;

  IF p_payload ? 'etapas' AND jsonb_typeof(p_payload->'etapas') = 'array' THEN
    FOR v_etapa IN SELECT * FROM jsonb_array_elements(p_payload->'etapas')
    LOOP
      CONTINUE WHEN NULLIF(BTRIM(COALESCE(v_etapa->>'nome', '')), '') IS NULL;

      v_etapa_id := NULLIF(v_etapa->>'id', '')::BIGINT;

      IF v_etapa_id IS NULL THEN
        INSERT INTO jornada_fluxo_etapas (
          fluxo_id, nome, descricao, ordem, prazo_dias, setor, responsavel_padrao_user_id, ativo
        )
        VALUES (
          v_id,
          BTRIM(v_etapa->>'nome'),
          NULLIF(BTRIM(COALESCE(v_etapa->>'descricao', '')), ''),
          COALESCE(NULLIF(v_etapa->>'ordem', '')::INTEGER, 1),
          NULLIF(v_etapa->>'prazo_dias', '')::INTEGER,
          NULLIF(BTRIM(COALESCE(v_etapa->>'setor', '')), ''),
          NULLIF(v_etapa->>'responsavel_padrao_user_id', '')::BIGINT,
          COALESCE((v_etapa->>'ativo')::BOOLEAN, TRUE)
        )
        RETURNING id INTO v_etapa_id;
      ELSE
        UPDATE jornada_fluxo_etapas
        SET
          nome = BTRIM(v_etapa->>'nome'),
          descricao = NULLIF(BTRIM(COALESCE(v_etapa->>'descricao', '')), ''),
          ordem = COALESCE(NULLIF(v_etapa->>'ordem', '')::INTEGER, 1),
          prazo_dias = NULLIF(v_etapa->>'prazo_dias', '')::INTEGER,
          setor = NULLIF(BTRIM(COALESCE(v_etapa->>'setor', '')), ''),
          responsavel_padrao_user_id = NULLIF(v_etapa->>'responsavel_padrao_user_id', '')::BIGINT,
          ativo = COALESCE((v_etapa->>'ativo')::BOOLEAN, TRUE)
        WHERE id = v_etapa_id AND fluxo_id = v_id;
      END IF;

      v_etapa_ids := v_etapa_ids || v_etapa_id;

      IF v_etapa ? 'checklist' AND jsonb_typeof(v_etapa->'checklist') = 'array' THEN
        v_check_ids := ARRAY[]::BIGINT[];

        FOR v_check IN SELECT * FROM jsonb_array_elements(v_etapa->'checklist')
        LOOP
          CONTINUE WHEN NULLIF(BTRIM(COALESCE(v_check->>'descricao', '')), '') IS NULL;

          IF NULLIF(v_check->>'id', '') IS NULL THEN
            INSERT INTO jornada_fluxo_checklist (fluxo_etapa_id, descricao, ordem, obrigatorio)
            VALUES (
              v_etapa_id,
              BTRIM(v_check->>'descricao'),
              COALESCE(NULLIF(v_check->>'ordem', '')::INTEGER, 1),
              COALESCE((v_check->>'obrigatorio')::BOOLEAN, TRUE)
            )
            RETURNING id INTO v_check_id;

            v_check_ids := v_check_ids || v_check_id;
          ELSE
            UPDATE jornada_fluxo_checklist
            SET
              descricao = BTRIM(v_check->>'descricao'),
              ordem = COALESCE(NULLIF(v_check->>'ordem', '')::INTEGER, 1),
              obrigatorio = COALESCE((v_check->>'obrigatorio')::BOOLEAN, TRUE)
            WHERE id = (v_check->>'id')::BIGINT AND fluxo_etapa_id = v_etapa_id;

            v_check_ids := v_check_ids || (v_check->>'id')::BIGINT;
          END IF;
        END LOOP;

        DELETE FROM jornada_fluxo_checklist
        WHERE fluxo_etapa_id = v_etapa_id
          AND NOT (id = ANY(COALESCE(v_check_ids, ARRAY[]::BIGINT[])));
      END IF;
    END LOOP;

    -- Etapa retirada do modelo: some se nunca foi usada, senão só é inativada
    -- para não apagar o andamento de jornadas em curso.
    FOR v_etapa_id IN
      SELECT id FROM jornada_fluxo_etapas
      WHERE fluxo_id = v_id AND NOT (id = ANY(v_etapa_ids))
    LOOP
      SELECT COUNT(*) INTO v_em_uso FROM jornada_etapa_itens WHERE fluxo_etapa_id = v_etapa_id;

      IF COALESCE(v_em_uso, 0) > 0 THEN
        UPDATE jornada_fluxo_etapas SET ativo = FALSE WHERE id = v_etapa_id;
      ELSE
        DELETE FROM jornada_fluxo_etapas WHERE id = v_etapa_id;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_jornada_fluxo(p_fluxo_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_em_uso INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_em_uso FROM jornadas WHERE fluxo_id = p_fluxo_id;

  IF COALESCE(v_em_uso, 0) > 0 THEN
    RAISE EXCEPTION 'Este fluxo é usado por % jornada(s). Inative-o em vez de excluir.', v_em_uso;
  END IF;

  DELETE FROM jornada_fluxos WHERE id = p_fluxo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fluxo não encontrado.';
  END IF;

  RETURN jsonb_build_object('id', p_fluxo_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. JORNADA — instanciar do fluxo, salvar cabeçalho e mexer numa etapa só
-- ═══════════════════════════════════════════════════════════════════════════

-- Copia para a jornada as etapas do fluxo que ainda não estão lá (inclusive as
-- que o fluxo ganhou depois), traz o checklist modelo e destrava a primeira
-- etapa. Chamada na criação e sempre que a jornada é aberta para edição.
CREATE OR REPLACE FUNCTION public.sincronizar_jornada_etapas(p_jornada_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_fluxo BIGINT;
  v_responsavel BIGINT;
  v_ativas INTEGER;
  v_primeira BIGINT;
BEGIN
  SELECT fluxo_id, responsavel_user_id INTO v_fluxo, v_responsavel
  FROM jornadas WHERE id = p_jornada_id;

  IF v_fluxo IS NULL THEN
    RETURN jsonb_build_object('id', p_jornada_id, 'etapas', 0);
  END IF;

  INSERT INTO jornada_etapa_itens (
    jornada_id, fluxo_etapa_id, ordem, status, prazo_dias, responsavel_user_id
  )
  SELECT
    p_jornada_id,
    fe.id,
    fe.ordem,
    'PENDENTE',
    fe.prazo_dias,
    COALESCE(fe.responsavel_padrao_user_id, v_responsavel)
  FROM jornada_fluxo_etapas fe
  WHERE fe.fluxo_id = v_fluxo
    AND fe.ativo = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM jornada_etapa_itens i
      WHERE i.jornada_id = p_jornada_id AND i.fluxo_etapa_id = fe.id
    );

  INSERT INTO jornada_item_checklist (item_id, fluxo_checklist_id, descricao, ordem, obrigatorio)
  SELECT i.id, fc.id, fc.descricao, fc.ordem, fc.obrigatorio
  FROM jornada_etapa_itens i
  JOIN jornada_fluxo_checklist fc ON fc.fluxo_etapa_id = i.fluxo_etapa_id
  WHERE i.jornada_id = p_jornada_id
    AND i.status NOT IN ('CONCLUIDA', 'NAO_APLICAVEL')
    AND NOT EXISTS (
      SELECT 1 FROM jornada_item_checklist c
      WHERE c.item_id = i.id AND c.fluxo_checklist_id = fc.id
    );

  SELECT COUNT(*) INTO v_ativas
  FROM jornada_etapa_itens
  WHERE jornada_id = p_jornada_id
    AND status IN ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO', 'CONCLUIDA');

  IF COALESCE(v_ativas, 0) = 0 THEN
    SELECT id INTO v_primeira
    FROM jornada_etapa_itens
    WHERE jornada_id = p_jornada_id AND status = 'PENDENTE'
    ORDER BY ordem, id
    LIMIT 1;

    IF v_primeira IS NOT NULL THEN
      UPDATE jornada_etapa_itens SET status = 'EM_ANDAMENTO' WHERE id = v_primeira;
    END IF;
  END IF;

  PERFORM public.recalc_jornada(p_jornada_id);

  RETURN jsonb_build_object('id', p_jornada_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_jornada(p_payload JSONB, p_user_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_entity_type TEXT;
  v_entity_id BIGINT;
  v_status TEXT;
  v_fluxo_id BIGINT;
  v_fluxo_atual BIGINT;
  v_data_inicio DATE;
  v_data_conclusao DATE;
  v_iniciadas INTEGER;
BEGIN
  -- Deixa o usuário visível para os gatilhos de histórico.
  PERFORM set_config('app.jornada_user_id', COALESCE(p_user_id::TEXT, ''), TRUE);

  v_id := NULLIF(p_payload->>'id', '')::BIGINT;
  v_status := COALESCE(NULLIF(p_payload->>'status', ''), 'ATIVA');
  v_fluxo_id := NULLIF(p_payload->>'fluxo_id', '')::BIGINT;
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

    IF v_fluxo_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o fluxo da jornada.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM jornadas WHERE entity_type = v_entity_type AND entity_id = v_entity_id
    ) THEN
      RAISE EXCEPTION 'Já existe uma jornada cadastrada para este registro.';
    END IF;

    INSERT INTO jornadas (
      entity_type, entity_id, fluxo_id, status, data_inicio, data_conclusao,
      responsavel_user_id, observacoes, created_by_user_id, updated_by_user_id
    )
    VALUES (
      v_entity_type, v_entity_id, v_fluxo_id, v_status, v_data_inicio, v_data_conclusao,
      NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT,
      NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), ''),
      p_user_id, p_user_id
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT fluxo_id INTO v_fluxo_atual FROM jornadas WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Jornada não encontrada.';
    END IF;

    -- Trocar de fluxo joga fora as etapas do modelo anterior; só é permitido
    -- enquanto nada saiu do lugar.
    IF v_fluxo_id IS NOT NULL AND v_fluxo_id IS DISTINCT FROM v_fluxo_atual THEN
      SELECT COUNT(*) INTO v_iniciadas
      FROM jornada_etapa_itens
      WHERE jornada_id = v_id AND status <> 'PENDENTE';

      IF COALESCE(v_iniciadas, 0) > 0 THEN
        RAISE EXCEPTION 'Não é possível trocar o fluxo: a jornada já tem etapa iniciada, concluída ou dispensada.';
      END IF;

      DELETE FROM jornada_etapa_itens WHERE jornada_id = v_id;
    END IF;

    UPDATE jornadas
    SET
      fluxo_id = COALESCE(v_fluxo_id, fluxo_id),
      status = v_status,
      data_inicio = v_data_inicio,
      data_conclusao = v_data_conclusao,
      responsavel_user_id = NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT,
      observacoes = NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), ''),
      updated_by_user_id = COALESCE(p_user_id, updated_by_user_id)
    WHERE id = v_id;
  END IF;

  PERFORM public.sincronizar_jornada_etapas(v_id);

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- Atualiza UMA etapa. É o que o painel de prazos e a caixa de tarefas usam para
-- mudar status sem abrir a jornada inteira.
CREATE OR REPLACE FUNCTION public.save_jornada_item(p_payload JSONB, p_user_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id BIGINT;
  v_status TEXT;
BEGIN
  PERFORM set_config('app.jornada_user_id', COALESCE(p_user_id::TEXT, ''), TRUE);

  v_item_id := NULLIF(p_payload->>'item_id', '')::BIGINT;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Etapa não informada.';
  END IF;

  v_status := NULLIF(p_payload->>'status', '');

  UPDATE jornada_etapa_itens
  SET
    status = COALESCE(v_status, status),
    responsavel_user_id = CASE
      WHEN p_payload ? 'responsavel_user_id'
        THEN NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT
      ELSE responsavel_user_id
    END,
    prazo_dias = CASE
      WHEN p_payload ? 'prazo_dias' THEN NULLIF(p_payload->>'prazo_dias', '')::INTEGER
      ELSE prazo_dias
    END,
    data_prevista = CASE
      WHEN p_payload ? 'data_prevista' THEN NULLIF(p_payload->>'data_prevista', '')::DATE
      ELSE data_prevista
    END,
    data_conclusao = CASE
      WHEN p_payload ? 'data_conclusao' THEN NULLIF(p_payload->>'data_conclusao', '')::DATE
      ELSE data_conclusao
    END,
    observacoes = CASE
      WHEN p_payload ? 'observacoes' THEN NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), '')
      ELSE observacoes
    END,
    aguardando_motivo = CASE
      WHEN p_payload ? 'aguardando_motivo' THEN NULLIF(BTRIM(COALESCE(p_payload->>'aguardando_motivo', '')), '')
      ELSE aguardando_motivo
    END
  WHERE id = v_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada.';
  END IF;

  RETURN jsonb_build_object('id', v_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_jornada_item_checklist(
  p_checklist_id BIGINT,
  p_concluido BOOLEAN,
  p_user_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE jornada_item_checklist
  SET
    concluido = COALESCE(p_concluido, FALSE),
    concluido_em = CASE WHEN COALESCE(p_concluido, FALSE) THEN NOW() END,
    concluido_por_user_id = CASE WHEN COALESCE(p_concluido, FALSE) THEN p_user_id END
  WHERE id = p_checklist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item do checklist não encontrado.';
  END IF;

  RETURN jsonb_build_object('id', p_checklist_id);
END;
$$;

-- Item avulso de checklist: o que aparece só naquele cliente e não vale a pena
-- subir para o modelo do fluxo.
CREATE OR REPLACE FUNCTION public.save_jornada_item_checklist(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_item_id BIGINT;
  v_descricao TEXT;
  v_ordem INTEGER;
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;
  v_item_id := NULLIF(p_payload->>'item_id', '')::BIGINT;
  v_descricao := NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), '');

  IF v_descricao IS NULL THEN
    RAISE EXCEPTION 'Informe a descrição do item do checklist.';
  END IF;

  IF v_id IS NULL THEN
    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'Etapa não informada.';
    END IF;

    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem
    FROM jornada_item_checklist WHERE item_id = v_item_id;

    INSERT INTO jornada_item_checklist (item_id, descricao, ordem, obrigatorio)
    VALUES (v_item_id, v_descricao, v_ordem, COALESCE((p_payload->>'obrigatorio')::BOOLEAN, TRUE))
    RETURNING id INTO v_id;
  ELSE
    UPDATE jornada_item_checklist
    SET
      descricao = v_descricao,
      obrigatorio = COALESCE((p_payload->>'obrigatorio')::BOOLEAN, obrigatorio)
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item do checklist não encontrado.';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_jornada_item_checklist(p_checklist_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM jornada_item_checklist WHERE id = p_checklist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item do checklist não encontrado.';
  END IF;

  RETURN jsonb_build_object('id', p_checklist_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. OBRIGAÇÕES — cadastro, vínculo com o cliente e geração de competências
-- ═══════════════════════════════════════════════════════════════════════════

-- Dia fixo do mês, com o dia maior que o mês ajustado para o último dia.
CREATE OR REPLACE FUNCTION public.obrigacao_data_vencimento(
  p_ano INTEGER, p_mes INTEGER, p_offset INTEGER, p_dia INTEGER
)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    base + (LEAST(
      GREATEST(p_dia, 1),
      EXTRACT(DAY FROM (base + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER
    ) - 1)
  )::DATE
  FROM (
    SELECT (MAKE_DATE(p_ano, p_mes, 1) + (COALESCE(p_offset, 0) || ' month')::INTERVAL)::DATE AS base
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.obrigacao_competencia_label(
  p_periodicidade TEXT, p_ano INTEGER, p_mes INTEGER
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_periodicidade
    WHEN 'ANUAL' THEN p_ano::TEXT
    WHEN 'SEMESTRAL' THEN (CASE WHEN p_mes <= 6 THEN '1º Sem/' ELSE '2º Sem/' END) || p_ano::TEXT
    WHEN 'TRIMESTRAL' THEN CEIL(p_mes::NUMERIC / 3)::INTEGER::TEXT || 'º Tri/' || p_ano::TEXT
    ELSE LPAD(p_mes::TEXT, 2, '0') || '/' || p_ano::TEXT
  END;
$$;

CREATE OR REPLACE FUNCTION public.save_obrigacao_catalogo(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_nome TEXT;
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;
  v_nome := NULLIF(BTRIM(p_payload->>'nome'), '');

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da obrigação.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM obrigacoes_catalogo
    WHERE LOWER(nome) = LOWER(v_nome) AND (v_id IS NULL OR id <> v_id)
  ) THEN
    RAISE EXCEPTION 'Já existe uma obrigação com o nome "%".', v_nome;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO obrigacoes_catalogo (
      nome, descricao, periodicidade, mes_ancora, dia_vencimento, mes_offset,
      prazo_interno_dias, setor, ativo
    )
    VALUES (
      v_nome,
      NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), ''),
      COALESCE(NULLIF(p_payload->>'periodicidade', ''), 'MENSAL'),
      NULLIF(p_payload->>'mes_ancora', '')::INTEGER,
      COALESCE(NULLIF(p_payload->>'dia_vencimento', '')::INTEGER, 15),
      COALESCE(NULLIF(p_payload->>'mes_offset', '')::INTEGER, 1),
      COALESCE(NULLIF(p_payload->>'prazo_interno_dias', '')::INTEGER, 0),
      NULLIF(BTRIM(COALESCE(p_payload->>'setor', '')), ''),
      COALESCE((p_payload->>'ativo')::BOOLEAN, TRUE)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE obrigacoes_catalogo
    SET
      nome = v_nome,
      descricao = NULLIF(BTRIM(COALESCE(p_payload->>'descricao', '')), ''),
      periodicidade = COALESCE(NULLIF(p_payload->>'periodicidade', ''), 'MENSAL'),
      mes_ancora = NULLIF(p_payload->>'mes_ancora', '')::INTEGER,
      dia_vencimento = COALESCE(NULLIF(p_payload->>'dia_vencimento', '')::INTEGER, 15),
      mes_offset = COALESCE(NULLIF(p_payload->>'mes_offset', '')::INTEGER, 1),
      prazo_interno_dias = COALESCE(NULLIF(p_payload->>'prazo_interno_dias', '')::INTEGER, 0),
      setor = NULLIF(BTRIM(COALESCE(p_payload->>'setor', '')), ''),
      ativo = COALESCE((p_payload->>'ativo')::BOOLEAN, TRUE)
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Obrigação não encontrada.';
    END IF;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_obrigacao_catalogo(p_obrigacao_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_em_uso INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_em_uso FROM obrigacoes_cliente WHERE obrigacao_id = p_obrigacao_id;

  IF COALESCE(v_em_uso, 0) > 0 THEN
    RAISE EXCEPTION 'Esta obrigação está vinculada a % cliente(s). Inative-a em vez de excluir.', v_em_uso;
  END IF;

  DELETE FROM obrigacoes_catalogo WHERE id = p_obrigacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obrigação não encontrada.';
  END IF;

  RETURN jsonb_build_object('id', p_obrigacao_id);
END;
$$;

-- Gera as competências que faltam, da data de início do vínculo (limitada a
-- p_meses_passado para não criar anos de backlog) até p_meses_futuro à frente.
-- Idempotente: rodar de novo não duplica nada.
CREATE OR REPLACE FUNCTION public.gerar_obrigacoes_competencias(
  p_meses_futuro INTEGER DEFAULT 3,
  p_meses_passado INTEGER DEFAULT 12,
  p_obrigacao_cliente_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_oc RECORD;
  v_passo INTEGER;
  v_ancora INTEGER;
  v_mes DATE;
  v_inicio DATE;
  v_limite DATE;
  v_fim DATE;
  v_venc DATE;
  v_ano INTEGER;
  v_num_mes INTEGER;
  v_criadas INTEGER := 0;
BEGIN
  v_limite := (DATE_TRUNC('month', CURRENT_DATE) + (GREATEST(COALESCE(p_meses_futuro, 3), 0) || ' month')::INTERVAL)::DATE;

  FOR v_oc IN
    SELECT
      oc.id, oc.data_inicio, oc.data_fim, oc.responsavel_user_id,
      c.periodicidade, c.mes_ancora, c.dia_vencimento, c.mes_offset, c.prazo_interno_dias
    FROM obrigacoes_cliente oc
    JOIN obrigacoes_catalogo c ON c.id = oc.obrigacao_id
    WHERE oc.ativo = TRUE
      AND c.ativo = TRUE
      AND (p_obrigacao_cliente_id IS NULL OR oc.id = p_obrigacao_cliente_id)
  LOOP
    v_passo := CASE v_oc.periodicidade
      WHEN 'MENSAL' THEN 1
      WHEN 'BIMESTRAL' THEN 2
      WHEN 'TRIMESTRAL' THEN 3
      WHEN 'SEMESTRAL' THEN 6
      ELSE 12
    END;

    v_ancora := COALESCE(v_oc.mes_ancora, CASE WHEN v_passo = 12 THEN 12 ELSE v_passo END);

    v_inicio := GREATEST(
      DATE_TRUNC('month', v_oc.data_inicio)::DATE,
      (DATE_TRUNC('month', CURRENT_DATE) - (GREATEST(COALESCE(p_meses_passado, 12), 0) || ' month')::INTERVAL)::DATE
    );

    v_fim := CASE
      WHEN v_oc.data_fim IS NULL THEN v_limite
      ELSE LEAST(v_limite, DATE_TRUNC('month', v_oc.data_fim)::DATE)
    END;

    v_mes := v_inicio;

    WHILE v_mes <= v_fim LOOP
      v_ano := EXTRACT(YEAR FROM v_mes)::INTEGER;
      v_num_mes := EXTRACT(MONTH FROM v_mes)::INTEGER;

      IF v_passo = 1 OR MOD(v_num_mes - v_ancora + 12, v_passo) = 0 THEN
        v_venc := public.obrigacao_data_vencimento(v_ano, v_num_mes, v_oc.mes_offset, v_oc.dia_vencimento);

        INSERT INTO obrigacoes_competencias (
          obrigacao_cliente_id, competencia_ano, competencia_mes, competencia_label,
          data_vencimento, data_limite_interna, responsavel_user_id
        )
        VALUES (
          v_oc.id, v_ano, v_num_mes,
          public.obrigacao_competencia_label(v_oc.periodicidade, v_ano, v_num_mes),
          v_venc,
          v_venc - COALESCE(v_oc.prazo_interno_dias, 0),
          v_oc.responsavel_user_id
        )
        ON CONFLICT (obrigacao_cliente_id, competencia_ano, competencia_mes) DO NOTHING;

        IF FOUND THEN
          v_criadas := v_criadas + 1;
        END IF;
      END IF;

      v_mes := (v_mes + INTERVAL '1 month')::DATE;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('criadas', v_criadas);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_obrigacao_cliente(p_payload JSONB, p_user_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
  v_entity_type TEXT;
  v_entity_id BIGINT;
  v_obrigacao_id BIGINT;
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;

  IF v_id IS NULL THEN
    v_entity_type := NULLIF(p_payload->>'entity_type', '');
    v_entity_id := NULLIF(p_payload->>'entity_id', '')::BIGINT;
    v_obrigacao_id := NULLIF(p_payload->>'obrigacao_id', '')::BIGINT;

    IF v_entity_type IS NULL OR v_entity_id IS NULL OR v_obrigacao_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o cliente e a obrigação.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM obrigacoes_cliente
      WHERE entity_type = v_entity_type AND entity_id = v_entity_id AND obrigacao_id = v_obrigacao_id
    ) THEN
      RAISE EXCEPTION 'Esta obrigação já está vinculada a este cliente.';
    END IF;

    INSERT INTO obrigacoes_cliente (
      entity_type, entity_id, obrigacao_id, responsavel_user_id,
      data_inicio, data_fim, ativo, observacoes, created_by_user_id
    )
    VALUES (
      v_entity_type, v_entity_id, v_obrigacao_id,
      NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT,
      COALESCE(NULLIF(p_payload->>'data_inicio', '')::DATE, CURRENT_DATE),
      NULLIF(p_payload->>'data_fim', '')::DATE,
      COALESCE((p_payload->>'ativo')::BOOLEAN, TRUE),
      NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), ''),
      p_user_id
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE obrigacoes_cliente
    SET
      responsavel_user_id = NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT,
      data_inicio = COALESCE(NULLIF(p_payload->>'data_inicio', '')::DATE, data_inicio),
      data_fim = NULLIF(p_payload->>'data_fim', '')::DATE,
      ativo = COALESCE((p_payload->>'ativo')::BOOLEAN, ativo),
      observacoes = NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), '')
    WHERE id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vínculo não encontrado.';
    END IF;

    -- Encerrou o vínculo: as competências futuras ainda em aberto somem.
    DELETE FROM obrigacoes_competencias oc
    USING obrigacoes_cliente c
    WHERE oc.obrigacao_cliente_id = c.id
      AND c.id = v_id
      AND c.data_fim IS NOT NULL
      AND oc.status = 'PENDENTE'
      AND MAKE_DATE(oc.competencia_ano, oc.competencia_mes, 1) > DATE_TRUNC('month', c.data_fim)::DATE;
  END IF;

  PERFORM public.gerar_obrigacoes_competencias(3, 12, v_id);

  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_obrigacao_cliente(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entregues INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_entregues
  FROM obrigacoes_competencias
  WHERE obrigacao_cliente_id = p_id AND status IN ('ENTREGUE', 'DISPENSADA');

  IF COALESCE(v_entregues, 0) > 0 THEN
    RAISE EXCEPTION 'Há % competência(s) já tratada(s). Encerre o vínculo com uma data fim em vez de excluir.', v_entregues;
  END IF;

  DELETE FROM obrigacoes_cliente WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo não encontrado.';
  END IF;

  RETURN jsonb_build_object('id', p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_obrigacao_competencia(p_payload JSONB, p_user_id BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  v_id := NULLIF(p_payload->>'id', '')::BIGINT;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Competência não informada.';
  END IF;

  UPDATE obrigacoes_competencias
  SET
    status = COALESCE(NULLIF(p_payload->>'status', ''), status),
    data_entrega = CASE
      WHEN p_payload ? 'data_entrega' THEN NULLIF(p_payload->>'data_entrega', '')::DATE
      ELSE data_entrega
    END,
    protocolo = CASE
      WHEN p_payload ? 'protocolo' THEN NULLIF(BTRIM(COALESCE(p_payload->>'protocolo', '')), '')
      ELSE protocolo
    END,
    responsavel_user_id = CASE
      WHEN p_payload ? 'responsavel_user_id' THEN NULLIF(p_payload->>'responsavel_user_id', '')::BIGINT
      ELSE responsavel_user_id
    END,
    observacoes = CASE
      WHEN p_payload ? 'observacoes' THEN NULLIF(BTRIM(COALESCE(p_payload->>'observacoes', '')), '')
      ELSE observacoes
    END,
    aguardando_motivo = CASE
      WHEN p_payload ? 'aguardando_motivo' THEN NULLIF(BTRIM(COALESCE(p_payload->>'aguardando_motivo', '')), '')
      ELSE aguardando_motivo
    END
  WHERE id = v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competência não encontrada.';
  END IF;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. VISÃO UNIFICADA DE TAREFAS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Etapa de jornada e competência de obrigação chegam com o mesmo formato para
-- o painel de prazos, a caixa do usuário, o sino e os relatórios.
--   data_limite            → o prazo que cobra (interno)
--   data_vencimento_legal  → só existe em obrigação, e não se move
--   dias_parados           → tempo aguardando terceiros, incluindo a pausa aberta

CREATE OR REPLACE VIEW public.vw_operacao_entidades AS
SELECT 'cliente'::TEXT AS entity_type, c.id AS entity_id, c.name AS entity_name FROM clientes c
UNION ALL
SELECT 'empresa'::TEXT, e.id, e.name FROM empresas e
UNION ALL
SELECT 'grupo'::TEXT, g.id, g.name FROM grupos g;

CREATE OR REPLACE VIEW public.vw_operacao_tarefas AS
SELECT
  'ETAPA'::TEXT AS origem,
  i.id AS referencia_id,
  j.id AS jornada_id,
  j.entity_type,
  j.entity_id,
  ent.entity_name AS cliente_nome,
  fe.nome AS titulo,
  COALESCE(f.nome, 'Jornada') AS contexto,
  fe.setor,
  i.status,
  (i.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')) AS aguardando,
  i.aguardando_motivo,
  COALESCE(i.responsavel_user_id, j.responsavel_user_id) AS responsavel_user_id,
  u.name AS responsavel_nome,
  i.data_limite,
  NULL::DATE AS data_vencimento_legal,
  CASE WHEN i.data_limite IS NULL THEN NULL ELSE (CURRENT_DATE - i.data_limite) END AS dias_atraso,
  COALESCE(i.dias_pausados, 0)
    + CASE WHEN i.pausado_em IS NOT NULL THEN GREATEST(CURRENT_DATE - i.pausado_em, 0) ELSE 0 END AS dias_parados,
  GREATEST(CURRENT_DATE - i.status_desde, 0) AS dias_no_status,
  i.checklist_total,
  i.checklist_concluidos
FROM jornada_etapa_itens i
JOIN jornadas j ON j.id = i.jornada_id
JOIN jornada_fluxo_etapas fe ON fe.id = i.fluxo_etapa_id
LEFT JOIN jornada_fluxos f ON f.id = j.fluxo_id
LEFT JOIN public.vw_operacao_entidades ent
  ON ent.entity_type = j.entity_type AND ent.entity_id = j.entity_id
LEFT JOIN users u ON u.id = COALESCE(i.responsavel_user_id, j.responsavel_user_id)
WHERE i.status NOT IN ('CONCLUIDA', 'NAO_APLICAVEL')
  AND j.status = 'ATIVA'

UNION ALL

SELECT
  'OBRIGACAO'::TEXT,
  k.id,
  NULL::BIGINT,
  oc.entity_type,
  oc.entity_id,
  ent.entity_name,
  cat.nome || ' · ' || k.competencia_label,
  cat.periodicidade,
  cat.setor,
  k.status,
  (k.status IN ('AGUARDANDO_CLIENTE', 'AGUARDANDO_ORGAO')),
  k.aguardando_motivo,
  COALESCE(k.responsavel_user_id, oc.responsavel_user_id),
  u.name,
  k.data_limite_interna,
  k.data_vencimento,
  (CURRENT_DATE - k.data_limite_interna),
  COALESCE(k.dias_pausados, 0)
    + CASE WHEN k.pausado_em IS NOT NULL THEN GREATEST(CURRENT_DATE - k.pausado_em, 0) ELSE 0 END,
  GREATEST(CURRENT_DATE - k.status_desde, 0),
  0,
  0
FROM obrigacoes_competencias k
JOIN obrigacoes_cliente oc ON oc.id = k.obrigacao_cliente_id
JOIN obrigacoes_catalogo cat ON cat.id = oc.obrigacao_id
LEFT JOIN public.vw_operacao_entidades ent
  ON ent.entity_type = oc.entity_type AND ent.entity_id = oc.entity_id
LEFT JOIN users u ON u.id = COALESCE(k.responsavel_user_id, oc.responsavel_user_id)
WHERE k.status NOT IN ('ENTREGUE', 'DISPENSADA')
  AND oc.ativo = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10b. RECÁLCULO DAS JORNADAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- recalc_jornada só roda por gatilho de item. As jornadas migradas precisam de
-- uma passada explícita para preencher etapa_atual_item_id com a nova regra
-- (em andamento > aguardando terceiros > próxima pendente).

DO $migracao$
DECLARE
  v_id BIGINT;
BEGIN
  FOR v_id IN SELECT id FROM jornadas LOOP
    PERFORM public.recalc_jornada(v_id);
  END LOOP;
END;
$migracao$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. CATÁLOGO INICIAL DE OBRIGAÇÕES (apenas quando vazio)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Prazos no formato "dia fixo do mês", conforme a regra escolhida para este
-- módulo. Confira cada um contra a legislação vigente e ajuste em
-- Operação > Catálogo de Obrigações — o dia e o deslocamento são editáveis.

INSERT INTO obrigacoes_catalogo (nome, descricao, periodicidade, mes_ancora, dia_vencimento, mes_offset, prazo_interno_dias, setor, ativo)
SELECT * FROM (
  VALUES
    ('DAS - Simples Nacional', 'Documento de arrecadação do Simples Nacional.', 'MENSAL', NULL::INTEGER, 20, 1, 3, 'Fiscal', TRUE),
    ('DCTFWeb', 'Declaração de débitos e créditos tributários federais previdenciários.', 'MENSAL', NULL, 15, 1, 3, 'Fiscal', TRUE),
    ('eSocial - Folha', 'Fechamento da folha e eventos periódicos do eSocial.', 'MENSAL', NULL, 15, 1, 4, 'Pessoal', TRUE),
    ('EFD-Contribuições', 'Escrituração fiscal digital de PIS/COFINS.', 'MENSAL', NULL, 10, 2, 5, 'Fiscal', TRUE),
    ('EFD ICMS/IPI', 'SPED Fiscal.', 'MENSAL', NULL, 20, 1, 5, 'Fiscal', TRUE),
    ('DCTF Mensal', 'Declaração de débitos e créditos tributários federais.', 'MENSAL', NULL, 15, 2, 3, 'Fiscal', TRUE),
    ('Fechamento contábil', 'Conciliação e fechamento do mês.', 'MENSAL', NULL, 25, 1, 5, 'Contábil', TRUE),
    ('DEFIS', 'Declaração de informações socioeconômicas e fiscais do Simples.', 'ANUAL', 12, 31, 3, 15, 'Fiscal', TRUE),
    ('DIRF', 'Declaração do imposto de renda retido na fonte.', 'ANUAL', 12, 28, 2, 10, 'Pessoal', TRUE),
    ('ECD', 'Escrituração contábil digital.', 'ANUAL', 12, 31, 5, 20, 'Contábil', TRUE),
    ('ECF', 'Escrituração contábil fiscal.', 'ANUAL', 12, 31, 7, 20, 'Contábil', TRUE)
) AS defaults(nome, descricao, periodicidade, mes_ancora, dia_vencimento, mes_offset, prazo_interno_dias, setor, ativo)
WHERE NOT EXISTS (SELECT 1 FROM obrigacoes_catalogo);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. RLS — mesmo padrão do módulo: fechado para anon/authenticated
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.jornada_fluxos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_fluxo_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_fluxo_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_item_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_etapa_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrigacoes_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrigacoes_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrigacoes_competencias ENABLE ROW LEVEL SECURITY;

-- Views não têm RLS: o acesso é revogado na unha para não vazar via PostgREST.
REVOKE ALL ON public.vw_operacao_entidades FROM anon, authenticated;
REVOKE ALL ON public.vw_operacao_tarefas FROM anon, authenticated;
