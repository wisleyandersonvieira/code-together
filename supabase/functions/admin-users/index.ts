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
 * Autorização de ACESSO (Etapa 4a): o signup público do GoTrue está habilitado,
 * então 'authenticated' não basta. O gate real é o claim app_metadata.status =
 * 'aprovado', que só esta função (service_role) escreve. As ações abaixo são a
 * única forma de conceder ou revogar esse claim.
 *
 * Ações:
 *   { action: 'create',       email, password, name, phone?, role?, status?, legacyUserId? }
 *   { action: 'set-password', email, password, role?, status? }  // cria a conta se não existir
 *   { action: 'set-status',   email, status, role? }             // concede/revoga acesso
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

/**
 * Traduz o status do app (tabela `users`: 'active' | 'inactive' | 'pending')
 * para o claim de autorização gravado em app_metadata.
 *
 * Só 'active' libera acesso: o admin pode criar uma conta já com senha mas
 * marcada como Inativo/Pendente na tela — nesse caso a conta existe no GoTrue,
 * a senha vale para o login, mas a execute-sql devolve 403 até ser aprovada.
 *
 * Ausência de status = 'active' (é o default da tela de criação pelo admin).
 */
function approvalClaimFor(status?: unknown): "aprovado" | "pendente" {
  return (status ?? "active") === "active" ? "aprovado" : "pendente";
}

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
    // authenticate() já exige app_metadata.status = 'aprovado' (ver _shared/jwt.ts):
    // um admin com a conta não aprovada também não passa daqui.
    const auth = await authenticate(req, "admin-users");
    if (isAuthError(auth)) {
      return json(
        { data: null, error: auth.status === 403 ? auth.error : "Não autorizado" },
        auth.status,
      );
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

    const normalisedEmail = email.trim().toLowerCase();

    // ── set-status ───────────────────────────────────────────────────────────
    // Sincroniza o claim de autorização da conta GoTrue com o status do app.
    // É o que efetivamente concede ou revoga acesso: mexer só na tabela legada
    // `users` não muda nada — o gate da execute-sql lê o JWT.
    //
    //   status 'active'              → app_metadata.status = 'aprovado'
    //   status 'inactive'/'pending'  → app_metadata.status = 'pendente' (403)
    //
    // Não exige senha: a conta já existe. Se ainda não existir, não é erro — o
    // acesso será liberado quando o admin definir a senha.
    if (action === "set-status") {
      const userId = await findAuthUserIdByEmail(normalisedEmail);

      if (!userId) {
        return json({
          data: [{ email: normalisedEmail, authAccount: false }],
          error: null,
        });
      }

      const claim = approvalClaimFor(status);

      // Trava anti-lockout: se o admin revogar o próprio acesso — e for o único
      // admin — ninguém consegue reaprovar ninguém pelo app; só via SQL direto.
      if (userId === auth.userId && claim !== "aprovado") {
        console.warn(`[admin-users] 400: admin ${auth.userId} tentou revogar o próprio acesso`);
        return json(
          { data: null, error: "Você não pode revogar o próprio acesso. Peça a outro administrador." },
          400,
        );
      }

      const { data: current } = await admin.auth.admin.getUserById(userId);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...(current?.user?.app_metadata ?? {}),
          status: claim,
          ...(role ? { role } : {}),
        },
      });

      if (error) {
        console.warn(`[admin-users] set-status falhou para ${userId}: ${error.message}`);
        return json({ data: null, error: error.message }, 400);
      }

      console.log(
        `[admin-users] usuário ${userId} → app_metadata.status='${claim}' (por ${auth.userId})`,
      );
      return json({ data: [{ id: userId, email: normalisedEmail, authAccount: true }], error: null });
    }

    // As ações restantes (create / set-password) definem senha.
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return json(
        { data: null, error: `Senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` },
        400,
      );
    }

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
        // Fonte de verdade de papel E aprovação — só o service_role escreve aqui.
        // Conta criada pelo admin nasce aprovada (salvo se ele a marcar como
        // Inativo/Pendente na tela); o signup público, não — o trigger
        // handle_new_user a deixa 'pendente'.
        app_metadata: { role: role ?? "user", status: approvalClaimFor(status) },
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
        // Definir a senha libera o acesso, então carrega a aprovação junto: sem
        // isto, um usuário vindo do signup público continuaria com a conta
        // 'pendente' e tomaria 403 mesmo com a senha que o admin acabou de dar.
        const { data: current } = await admin.auth.admin.getUserById(userId);
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password,
          app_metadata: {
            ...(current?.user?.app_metadata ?? {}),
            status: approvalClaimFor(status),
            ...(role ? { role } : {}),
          },
        });
        if (error) {
          console.warn(`[admin-users] updateUserById falhou: ${error.message}`);
          return json({ data: null, error: error.message }, 400);
        }
        return json({ data: [{ id: userId, email: normalisedEmail, created: false }], error: null });
      }

      // Sem conta no GoTrue (ex.: usuário que se cadastrou pela tela pública e
      // foi aprovado): criar agora, já com a senha definida pelo admin. Definir
      // a senha é um ato deliberado do admin de liberar acesso → nasce aprovada.
      const { data, error } = await admin.auth.admin.createUser({
        email: normalisedEmail,
        password,
        email_confirm: true,
        user_metadata: { name: name ?? normalisedEmail },
        app_metadata: { role: role ?? "user", status: approvalClaimFor(status) },
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
