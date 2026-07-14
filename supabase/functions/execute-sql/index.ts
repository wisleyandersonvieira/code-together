import { corsHeadersFor } from "../_shared/cors.ts";
import { authenticate, isAuthError } from "../_shared/jwt.ts";

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
