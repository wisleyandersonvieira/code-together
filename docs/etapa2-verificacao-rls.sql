-- ETAPA 2 — Script de verificação (rodar no SQL Editor DEPOIS de aplicar
-- a migration 1760200000_enable_rls_and_close_postgrest.sql).
--
-- Os três blocos devem sair exatamente como descrito. Qualquer linha a mais
-- nos blocos 1 e 2 é uma brecha que sobrou.

-- ─── 1. Tabelas do public SEM RLS ────────────────────────────────────────────
-- Esperado: NENHUMA linha.
SELECT
  tablename AS tabela_sem_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND NOT rowsecurity
ORDER BY tablename;

-- ─── 2. Grants remanescentes do role anon no schema public ───────────────────
-- Esperado: NENHUMA linha (tabelas, sequences e functions).
SELECT
  'tabela'   AS objeto,
  table_name AS nome,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'

UNION ALL

SELECT
  'sequence'    AS objeto,
  object_name   AS nome,
  privilege_type
FROM information_schema.role_usage_grants
WHERE grantee = 'anon'
  AND object_schema = 'public'

UNION ALL

SELECT
  'function'     AS objeto,
  routine_name   AS nome,
  privilege_type
FROM information_schema.role_routine_grants
WHERE grantee = 'anon'
  AND routine_schema = 'public'

ORDER BY objeto, nome;

-- ─── 3. app_executor precisa estar isento de RLS ─────────────────────────────
-- Esperado: rolbypassrls = true, rolsuper = false, rolcreatedb = false,
--           rolcreaterole = false.
SELECT
  rolname,
  rolbypassrls,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolcanlogin
FROM pg_roles
WHERE rolname = 'app_executor';

-- ─── 4. Panorama: RLS x policies por tabela (informativo) ────────────────────
-- Tabelas com policy_count = 0 estão negadas por padrão para anon/authenticated
-- (é o estado desejado para quase tudo). As que já tinham policies funcionais —
-- profiles, periodos_bloqueados, periodos_bloqueados_matrizes — devem continuar
-- aparecendo aqui com policy_count > 0.
SELECT
  t.tablename,
  t.rowsecurity AS rls_ativo,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY policy_count DESC, t.tablename;
