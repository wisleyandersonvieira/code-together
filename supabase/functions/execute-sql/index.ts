import { corsHeadersFor } from "../_shared/cors.ts";
import { authenticate, isAuthError } from "../_shared/jwt.ts";
// A interpolação de template e a guarda de statements moram em módulo próprio
// desde a correção do escape duplo: são o código de SEGURANÇA da função, e
// enquanto estavam aqui — num arquivo que faz `Deno.serve` no topo — não havia
// como executá-los num teste. Ver sql-template.test.ts.
import { guardStatement, processTemplate } from "./sql-template.ts";

/**
 * Conexão de banco usada para rodar as queries do app.
 *
 * APP_DB_URL deve apontar para o role `app_executor` (ver migration
 * 1760100000_create_app_executor_role.sql) usando a porta 6543 do pooler
 * (Supavisor) do Supabase — edge functions são efêmeras e não devem abrir
 * conexões diretas na 5432:
 *
 *   postgresql://app_executor:<senha>@<host>:6543/postgres
 *
 * Fallback temporário para SUPABASE_DB_URL (role postgres, superusuário)
 * apenas para não quebrar o app antes da secret ser configurada.
 */
function getDbUrl(): string {
  const appDbUrl = Deno.env.get("APP_DB_URL");
  if (appDbUrl) return appDbUrl;

  const fallback = Deno.env.get("SUPABASE_DB_URL");
  if (!fallback) {
    throw new Error("Nem APP_DB_URL nem SUPABASE_DB_URL estão configuradas");
  }

  console.warn(
    "[execute-sql] APP_DB_URL não configurada — usando SUPABASE_DB_URL (role privilegiado). " +
      "Configure APP_DB_URL com a connection string do role app_executor (porta 6543).",
  );
  return fallback;
}

// ─── Clients de módulo (criados uma vez por instância da função) ──────────────

let sqlClient: any = null;

async function getSql() {
  if (!sqlClient) {
    const mod = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const pg = mod.default;
    // Pool reaproveitado entre requisições da mesma instância — sem sql.end()
    // por requisição, que era o que forçava um handshake novo a cada chamada.
    sqlClient = pg(getDbUrl(), {
      max: 3,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return sqlClient;
}

// ─── Camada 1: autenticação ──────────────────────────────────────────────────
// Verificação local do JWT via JWKS — ver ../_shared/jwt.ts

// ─── Camada 2: guarda de statements ──────────────────────────────────────────
// `scrub`, `guardStatement` e `processTemplate` vivem em ./sql-template.ts.

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Reflete a origem da requisição quando ela está na lista de ALLOWED_ORIGIN.
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
    // Camada 1 — usuário autenticado E aprovado (anon key é rejeitada; conta
    // criada pelo signup público, sem aprovação de admin, leva 403 aqui).
    const auth = await authenticate(req, "execute-sql");
    if (isAuthError(auth)) {
      // 403 → o motivo é acionável pelo usuário ("peça aprovação ao admin").
      // 401 → mensagem genérica: não devolvemos diagnóstico de token ao cliente.
      return json(
        { data: null, error: auth.status === 403 ? auth.error : "Não autorizado" },
        auth.status,
      );
    }
    const { userId } = auth;

    const { query, params } = await req.json();

    if (!query || typeof query !== "string") {
      return json({ error: "Missing or invalid 'query' parameter" }, 400);
    }

    const processedQuery = processTemplate(query, params || {});
    const cleanQuery = processedQuery.replace(/;\s*$/, "").trim();

    // Camada 2 — guarda de statements
    const guard = guardStatement(cleanQuery);
    if (!guard.ok) {
      console.warn(
        `[execute-sql] 403 user=${userId} motivo=${guard.reason} query=${cleanQuery.substring(0, 200)}`,
      );
      return json({ data: null, error: `Query rejeitada: ${guard.reason}` }, 403);
    }

    console.log(`[execute-sql] user=${userId} query: ${cleanQuery.substring(0, 200)}...`);

    try {
      const sql = await getSql();
      const result = await sql.unsafe(cleanQuery);

      return json({ data: Array.from(result), error: null });
    } catch (pgError: any) {
      console.error(`[execute-sql] SQL error:`, pgError.message);
      console.error(`[execute-sql] Failed query:`, cleanQuery.substring(0, 500));
      return json({ data: null, error: pgError.message }, 400);
    }
  } catch (error: any) {
    console.error(`[execute-sql] Error:`, error.message);
    return json({ error: error.message }, 500);
  }
});
