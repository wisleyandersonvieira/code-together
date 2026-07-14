import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// ─── Configuração ────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

/** Lê o campo `role` do payload do JWT sem validar assinatura (a validação real é o getUser). */
function readJwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalised = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=")));
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

type AuthResult = { userId: string } | { error: string };

async function authenticate(req: Request): Promise<AuthResult> {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { error: "Authorization header ausente" };
  }

  const token = match[1].trim();

  // A anon key é um JWT válido, mas não representa um usuário: rejeitar antes
  // mesmo de consultar o GoTrue.
  const role = readJwtRole(token);
  if (role === "anon" || role === "service_role") {
    return { error: `Token de role '${role}' não representa um usuário autenticado` };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return { error: "Token inválido ou expirado" };
  }

  return { userId: data.user.id };
}

// ─── Camada 2: guarda de statements ──────────────────────────────────────────

const ALLOWED_FIRST_TOKENS = ["SELECT", "WITH", "INSERT", "UPDATE", "DELETE"];

const FORBIDDEN = [
  "DROP",
  "ALTER",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "CREATE",
  "COPY",
  "VACUUM",
  "pg_sleep",
  "pg_read_file",
  "pg_catalog",
  "information_schema",
  "dblink",
];

/**
 * Remove comentários SQL e substitui o conteúdo de literais de string por vazio.
 * Todas as validações rodam sobre este texto, então nem um `--` nem um valor de
 * texto contendo "DROP" conseguem burlar ou disparar a guarda por engano.
 */
function scrub(query: string): string {
  let out = "";
  let i = 0;

  while (i < query.length) {
    const c = query[i];
    const next = query[i + 1];

    // Literal de string: '...' (com '' como escape interno)
    if (c === "'") {
      out += "''";
      i++;
      while (i < query.length) {
        if (query[i] === "'" && query[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (query[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Identificador entre aspas duplas: preservado como espaço
    if (c === '"') {
      i++;
      while (i < query.length && query[i] !== '"') i++;
      i++;
      out += " ";
      continue;
    }

    // Comentário de linha
    if (c === "-" && next === "-") {
      while (i < query.length && query[i] !== "\n") i++;
      out += " ";
      continue;
    }

    // Comentário de bloco
    if (c === "/" && next === "*") {
      i += 2;
      while (i < query.length && !(query[i] === "*" && query[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

type GuardResult = { ok: true } | { ok: false; reason: string };

function guardStatement(query: string): GuardResult {
  const scrubbed = scrub(query).trim().replace(/;\s*$/, "").trim();

  if (!scrubbed) {
    return { ok: false, reason: "Query vazia após remoção de comentários" };
  }

  // Statement único: qualquer ';' remanescente (fora de literais) indica
  // encadeamento de comandos.
  if (scrubbed.includes(";")) {
    return { ok: false, reason: "Múltiplos statements não são permitidos" };
  }

  const firstToken = (scrubbed.match(/^[a-zA-Z_]+/) ?? [""])[0].toUpperCase();
  if (!ALLOWED_FIRST_TOKENS.includes(firstToken)) {
    return { ok: false, reason: `Comando '${firstToken || "?"}' não permitido` };
  }

  for (const word of FORBIDDEN) {
    const re = new RegExp(`\\b${word}\\b`, "i");
    if (re.test(scrubbed)) {
      return { ok: false, reason: `Termo proibido na query: '${word}'` };
    }
  }

  return { ok: true };
}

// ─── Template UIBakery ───────────────────────────────────────────────────────

/**
 * Evaluates UIBakery-style template expressions in SQL queries.
 * Handles both:
 *   - Simple: {{params.key}}
 *   - Conditional: {{ params && params.key ? "SQL fragment" : "" }}
 */
function processTemplate(query: string, params: Record<string, any>): string {
  const processed = query.replace(/'?\{\{([\s\S]*?)\}\}'?/g, (_match, expr: string) => {
    const trimmed = expr.trim();
    const wrappedInQuotes = _match.startsWith("'") && _match.endsWith("'");

    // Simple param reference: params.key or params.key::type
    const simpleMatch = trimmed.match(/^params\.(\w+)(::.*)?$/);
    if (simpleMatch) {
      const key = simpleMatch[1];
      const cast = simpleMatch[2] || "";
      const value = params[key];
      if (value === null || value === undefined) {
        return "NULL" + cast;
      } else if (typeof value === "number" || typeof value === "boolean") {
        return String(value) + cast;
      } else {
        const escaped = String(value).replace(/'/g, "''");
        return `'${escaped}'` + cast;
      }
    }

    // Complex expression
    try {
      const fn = new Function("params", `
        try {
          return (${trimmed});
        } catch(e) {
          return "";
        }
      `);
      const result = fn(params);
      if (result === null || result === undefined || result === false) {
        return wrappedInQuotes ? "''" : "";
      }
      if (wrappedInQuotes) {
        const escaped = String(result).replace(/'/g, "''");
        return `'${escaped}'`;
      }
      return String(result);
    } catch (_e) {
      console.warn(`[execute-sql] Failed to evaluate expression: ${trimmed}`);
      return wrappedInQuotes ? "''" : "";
    }
  });

  return processed;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Camada 1 — usuário autenticado (anon key é rejeitada)
    const auth = await authenticate(req);
    if ("error" in auth) {
      console.warn(`[execute-sql] 401: ${auth.error}`);
      return json({ data: null, error: "Não autorizado" }, 401);
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
