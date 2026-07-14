-- ETAPA 3 — Eliminar os hashes de senha da tabela legada `users`.
--
-- Contexto da auditoria (Etapa 3a/3c):
--   * O login do app é GoTrue (auth.users). A tabela `users` NÃO é fonte de
--     verdade de autenticação.
--   * NENHUM código lê users.password_hash. O único leitor era a edge function
--     auth-login, removida nesta etapa.
--   * As duas telas que ESCREVIAM esse hash (UserForm e SetPasswordForm) foram
--     migradas para a edge function admin-users, que cria/atualiza a senha no
--     GoTrue de verdade — a senha definida pelo admin agora funciona no login.
--
-- Portanto os hashes remanescentes são segredo morto: não autenticam ninguém e
-- só representam risco (parte deles é btoa(), ou seja, reversível).
--
-- Idempotente: reaplicar não tem efeito.

UPDATE users
SET password_hash = NULL
WHERE password_hash IS NOT NULL;

-- Tokens de reset do fluxo legado (também morto — o reset real é o
-- resetPasswordForEmail do GoTrue).
UPDATE users
SET password_reset_token = NULL,
    password_reset_expires = NULL
WHERE password_reset_token IS NOT NULL
   OR password_reset_expires IS NOT NULL;
