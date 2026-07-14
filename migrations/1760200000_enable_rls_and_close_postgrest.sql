-- ETAPA 2 — RLS em todas as tabelas do schema public + fechamento do PostgREST.
--
-- Objetivo: fechar a API REST automática (PostgREST) para os roles `anon` e
-- `authenticated`. A segurança do caminho principal do app já é garantida pelo
-- gate da edge function execute-sql (Etapa 1); esta migration fecha o canal
-- lateral que hoje devolve users/clientes/aportes/contas_pagar para quem tiver
-- apenas a anon key.
--
-- IMPORTANTE: RLS TAMBÉM se aplica a roles com conexão direta. Só o dono da
-- tabela, superusers e roles com BYPASSRLS ficam isentos. Como o app_executor
-- não é dono das tabelas, ele PRECISA de BYPASSRLS — sem isso o app inteiro
-- passa a enxergar zero linhas assim que o RLS entrar.
--
-- Idempotente: pode ser reaplicada sem efeito colateral.
-- Rodar como `postgres` (dono das tabelas / dono dos default privileges).

-- ─── 1. app_executor fica isento de RLS ──────────────────────────────────────

ALTER ROLE app_executor BYPASSRLS;

-- ─── 2. RLS ativo em TODAS as tabelas do schema public ───────────────────────
--
-- Loop sobre o catálogo em vez de lista fixa: cobre qualquer tabela existente,
-- inclusive as criadas por migrations futuras que rodarem antes desta ser
-- reaplicada. ENABLE em tabela que já tem RLS é no-op, então as tabelas que já
-- possuem policies funcionais (profiles, periodos_bloqueados,
-- periodos_bloqueados_matrizes) permanecem exatamente como estão.
--
-- Nenhuma policy nova é criada de propósito: RLS ativo sem policy = negado por
-- padrão para todo mundo que passa pelo RLS (ou seja, anon e authenticated).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$$;

-- ─── 3. Revogar privilégios do role anon no schema public ────────────────────
--
-- Defesa em profundidade: mesmo com RLS negando, o anon não deve sequer ter
-- GRANT nas tabelas. Não revogamos de `authenticated` (o RLS sem policy já
-- nega, e revogar pode quebrar o fluxo do GoTrue com profiles) nem de
-- `service_role`.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Tabelas/sequences criadas no futuro também nascem sem acesso para o anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
