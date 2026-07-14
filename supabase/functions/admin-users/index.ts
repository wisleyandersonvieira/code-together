/**
 * admin-users — administração de contas no GoTrue (auth.users), restrita a admin.
 *
 * Substitui o fluxo legado, em que o app gravava um hash de senha na tabela
 * `users` que NINGUÉM lia: o login é GoTrue, então a senha definida pelo admin
 * nunca funcionava. Aqui a conta é criada de verdade no GoTrue, e a senha
 * passa a valer no login.
 *
 * Autorização (mesmo padrão do execute-sql):
 *   1. JWT verificado localmente contra o JWKS do projeto (role authenticated)
 *   2. o autor da chamada precisa ter app_metadata.role = 'admin' no GoTrue
 *
 * NÃO usamos profiles.role para essa decisão: o usuário consegue escrever no
 * próprio profile (e escrevia até na coluna role — ver migration
 * 1760400000_fix_profiles_role_escalation.sql). app_metadata só o service_role
 * escreve, então é a única fonte de verdade confiável para o papel.
 *
 * A service_role key só existe aqui dentro — nunca no front.
 *
 * Ações:
 *   { action: 'create',       email, password, name, phone?, role?, status?, legacyUserId? }
 *   { action: 'set-password', email, password }   // cria a conta se ainda não existir
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersFor } from "../_shared/cors.ts";
import { authenticate, isAuthError } from "../_shared/jwt.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MIN_PASSWORD_LENGTH = 8;

async function isAdmin(userId: string): Promise<boolean> {
  // app_metadata vive em auth.users e não é gravável pelo usuário.
  const { data, error } = await admin.auth.admin.getUserById(userId);

  if (error || !data?.user) {
    console.warn(`[admin-users] falha ao ler auth user ${userId}: ${error?.message}`);
    return false;
  }
  return data.user.app_metadata?.role === "admin";
}

/** Procura a conta GoTrue pelo e-mail (via profiles, que espelha auth.users). */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  return data?.id ?? null;
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const auth = await authenticate(req, "admin-users");
    if (isAuthError(auth)) {
      return json({ data: null, error: "Não autorizado" }, 401);
    }

    if (!(await isAdmin(auth.userId))) {
      console.warn(`[admin-users] 403: usuário ${auth.userId} não é admin`);
      return json({ data: null, error: "Acesso restrito a administradores" }, 403);
    }

    const body = await req.json();
    const { action, email, password, name, phone, role, status, legacyUserId } = body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return json({ data: null, error: "E-mail é obrigatório" }, 400);
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return json(
        { data: null, error: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` },
        400,
      );
    }

    const normalisedEmail = email.trim().toLowerCase();

    // ── create ───────────────────────────────────────────────────────────────
    if (action === "create") {
      const existing = await findAuthUserIdByEmail(normalisedEmail);
      if (existing) {
        return json({ data: null, error: "Já existe um usuário com este e-mail" }, 409);
      }

      // email_confirm: true → conta nasce ativa, sem depender de e-mail de confirmação.
      const { data, error } = await admin.auth.admin.createUser({
        email: normalisedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: name ?? normalisedEmail },
        // Fonte de verdade do papel — só o service_role escreve aqui.
        app_metadata: { role: role ?? "user" },
      });

      if (error || !data?.user) {
        console.warn(`[admin-users] createUser falhou: ${error?.message}`);
        return json({ data: null, error: error?.message ?? "Falha ao criar usuário" }, 400);
      }

      // O trigger on_auth_user_created já criou o profile com name/role/status;
      // completamos os campos que o GoTrue não conhece.
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          phone: phone ?? null,
          status: status ?? "active",
          role: role ?? "user",
          legacy_user_id: legacyUserId ?? null,
        })
        .eq("id", data.user.id);

      if (profileError) {
        console.warn(`[admin-users] profile update falhou: ${profileError.message}`);
      }

      return json({ data: [{ id: data.user.id, email: normalisedEmail }], error: null });
    }

    // ── set-password ─────────────────────────────────────────────────────────
    if (action === "set-password") {
      const userId = await findAuthUserIdByEmail(normalisedEmail);

      if (userId) {
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) {
          console.warn(`[admin-users] updateUserById falhou: ${error.message}`);
          return json({ data: null, error: error.message }, 400);
        }
        return json({ data: [{ id: userId, email: normalisedEmail, created: false }], error: null });
      }

      // Sem conta no GoTrue (ex.: usuário que se cadastrou pela tela pública e
      // foi aprovado): criar agora, já com a senha definida pelo admin.
      const { data, error } = await admin.auth.admin.createUser({
        email: normalisedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: name ?? normalisedEmail },
        app_metadata: { role: role ?? "user" },
      });

      if (error || !data?.user) {
        console.warn(`[admin-users] createUser (set-password) falhou: ${error?.message}`);
        return json({ data: null, error: error?.message ?? "Falha ao definir senha" }, 400);
      }

      return json({ data: [{ id: data.user.id, email: normalisedEmail, created: true }], error: null });
    }

    return json({ data: null, error: "Ação inválida" }, 400);
  } catch (err) {
    console.error(`[admin-users] erro:`, (err as Error)?.message);
    return json({ data: null, error: "Falha ao processar a requisição" }, 500);
  }
});
