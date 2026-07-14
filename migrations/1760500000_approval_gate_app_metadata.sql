-- ETAPA 4a — Gate de aprovação: app_metadata.status é a fonte de verdade.
--
-- CONTEXTO: o signup público do GoTrue permanece HABILITADO. Qualquer pessoa
-- cria conta e recebe um JWT com role 'authenticated' — que até aqui era tudo
-- o que a execute-sql exigia. Ou seja: um estranho conseguia rodar SELECT /
-- INSERT / UPDATE / DELETE no banco do app.
--
-- O app JÁ tem um fluxo de aprovação, mas ele não protegia nada:
--   * a aprovação vive em public.users.status ('pending' -> 'active'), uma
--     tabela LEGADA que o login nem consulta (o login é GoTrue);
--   * o trigger handle_new_user carimbava profiles.status = 'active' para
--     TODO MUNDO, inclusive quem entrou pelo signup público.
--
-- A partir daqui a autorização passa a exigir, no próprio JWT:
--     app_metadata.status = 'aprovado'
-- app_metadata (auth.users.raw_app_meta_data) só o service_role escreve — o
-- usuário não alcança, ao contrário de user_metadata (auth.updateUser). Mesmo
-- padrão já adotado para o papel na 1760400000_fix_profiles_role_escalation.
--
-- Como o GoTrue embute app_metadata nos claims do access token, a checagem
-- continua LOCAL nas edge functions (sem round-trip por requisição).
--
-- ORDEM DE APLICAÇÃO: esta migration roda ANTES do deploy das functions.
-- Invertendo a ordem, todos os usuários atuais tomam 403.
--
-- Idempotente.

-- ─── 1. Semear os usuários já ativos hoje ────────────────────────────────────
-- "Ativo hoje" = uma destas condições, em ordem de confiança:
--   a) é admin (profiles.role = 'admin') — não podemos trancar o admin para
--      fora, senão ninguém consegue aprovar mais ninguém (a admin-users passa
--      a exigir o claim também);
--   b) tem vínculo explícito com a tabela legada (profiles.legacy_user_id) e
--      lá o status é 'active';
--   c) sem vínculo explícito, casa por e-mail (case-insensitive) com uma linha
--      'active' de public.users.
--
-- Quem não cair em (a), (b) ou (c) NÃO é semeado: fica sem o claim e leva 403.
-- O bloco 3 lista essas contas para conferência manual.

UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('status', 'aprovado')
WHERE COALESCE(u.raw_app_meta_data->>'status', '') IS DISTINCT FROM 'aprovado'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = u.id
      AND (
        -- (a) admin
        p.role = 'admin'
        -- (b) vínculo explícito com a tabela legada
        OR EXISTS (
          SELECT 1 FROM public.users lu
          WHERE lu.id = p.legacy_user_id
            AND lu.status = 'active'
        )
        -- (c) casamento por e-mail
        OR EXISTS (
          SELECT 1 FROM public.users lu
          WHERE lower(lu.email) = lower(u.email)
            AND lu.status = 'active'
        )
      )
  );

-- ─── 2. Trigger: signup público NÃO nasce aprovado ───────────────────────────
-- O status vem exclusivamente de raw_app_meta_data (service_role). Sem ele —
-- que é o caso do signup público — a conta nasce 'pendente'.
--
-- Vocabulário: app_metadata.status usa 'aprovado'/'pendente'; a coluna
-- profiles.status continua no vocabulário do app ('active'/'pending'), então
-- traduzimos na hora de gravar para não quebrar as telas existentes.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_status text := COALESCE(NEW.raw_app_meta_data->>'status', 'pendente');
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    -- NUNCA de raw_user_meta_data: o usuário consegue escrever lá.
    COALESCE(NEW.raw_app_meta_data->>'role', 'user'),
    CASE WHEN meta_status = 'aprovado' THEN 'active' ELSE 'pending' END
  );
  RETURN NEW;
END;
$$;

-- ─── 3. Relatório: quem NÃO foi semeado ──────────────────────────────────────
-- Estas contas existem no GoTrue mas não foram reconhecidas como ativas. Elas
-- levam 403 na execute-sql até que um admin as aprove (a aprovação passa a
-- gravar o claim via edge function admin-users).
--
-- Aprovação manual de uma conta específica, se necessário:
--   UPDATE auth.users
--   SET raw_app_meta_data =
--         COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"status":"aprovado"}'::jsonb
--   WHERE email = 'fulano@exemplo.com';

DO $$
DECLARE
  r record;
  total int := 0;
BEGIN
  FOR r IN
    SELECT u.email,
           u.created_at,
           COALESCE(p.role, '?')   AS profile_role,
           COALESCE(p.status, '?') AS profile_status
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE COALESCE(u.raw_app_meta_data->>'status', '') IS DISTINCT FROM 'aprovado'
    ORDER BY u.created_at
  LOOP
    total := total + 1;
    RAISE NOTICE 'NAO SEMEADO: % (criado em %, profiles.role=%, profiles.status=%)',
      r.email, r.created_at, r.profile_role, r.profile_status;
  END LOOP;

  RAISE NOTICE '--- Etapa 4a: % conta(s) sem app_metadata.status=aprovado (levarão 403 até serem aprovadas) ---', total;
END;
$$;
