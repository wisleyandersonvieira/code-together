-- ETAPA 3 — Corrigir escalada de privilégio para 'admin'.
--
-- PROBLEMA 1 (confirmado em produção): a policy de UPDATE de `profiles`
--   USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
-- restringe a LINHA, mas não as COLUNAS — e o role `authenticated` tem UPDATE
-- na tabela inteira. Um PATCH em /rest/v1/profiles?id=eq.<meu_id> com
-- {"role":"admin"} retornava 200. Qualquer usuário logado podia virar admin.
--
-- PROBLEMA 2: o trigger handle_new_user lê o role de raw_user_meta_data, que é
-- gravável pelo próprio usuário (auth.updateUser). Com o signup público
-- habilitado, dava para nascer admin.
--
-- Fonte de verdade do papel passa a ser auth.users.raw_app_meta_data, que só o
-- service_role escreve (o usuário não tem como tocar). A coluna profiles.role
-- continua existindo para exibição, mas deixa de ser escrevível pelo usuário.
--
-- Idempotente.

-- ─── 1. Privilégios por COLUNA em profiles ───────────────────────────────────
-- Sem UPDATE na tabela inteira, o authenticated só escreve name e phone.
-- Privilégio de coluna é verificado independentemente do RLS, então isto barra
-- a autopromoção mesmo com a policy permissiva.

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, phone) ON public.profiles TO authenticated;

-- INSERT/DELETE em profiles são responsabilidade do trigger/service_role.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;

-- ─── 2. Trigger deixa de confiar em user_metadata ────────────────────────────
-- O papel vem de raw_app_meta_data (só service_role escreve). Sem ele, 'user'.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    -- NUNCA de raw_user_meta_data: o usuário consegue escrever lá.
    COALESCE(NEW.raw_app_meta_data->>'role', 'user'),
    'active'
  );
  RETURN NEW;
END;
$$;

-- ─── 3. Semear o papel atual dos usuários em app_metadata ────────────────────
-- Os admins de hoje estão marcados em profiles.role; replicamos para o
-- app_metadata, que é o que a edge function admin-users passa a consultar.

UPDATE auth.users u
SET raw_app_meta_data =
      COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE p.id = u.id
  AND COALESCE(u.raw_app_meta_data->>'role', '') IS DISTINCT FROM p.role;
