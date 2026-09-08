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

// ─── Identidade do isolate (instrumentação — 1.2) ────────────────────────────
/**
 * `BOOT_ID` e `contadorRequisicoes` são estado de MÓDULO: nascem uma vez por
 * isolate e sobrevivem enquanto ele viver. É exatamente por isso que servem de
 * prova.
 *
 * Se o mesmo `boot=` aparecer com `req=1, 2, 3…` nos logs, o isolate está sendo
 * reaproveitado e o cache de módulo funciona — o `sqlClient` abaixo e o JWKS do
 * _shared/jwt.ts estão quentes, e o segundo por requisição vem de outro lugar.
 *
 * Se cada requisição trouxer um `boot=` novo com `req=1`, o isolate é reciclado
 * a cada chamada: nenhum cache de módulo vale nada, o `import()` remoto do
 * postgres.js e o do jose (esm.sh) são pagos toda vez, e o pool de conexões
 * nunca é reaproveitado apesar do comentário do `getSql()` dizer que é.
 *
 * Custo: um UUID por isolate e um incremento por requisição.
 */
const BOOT_ID = crypto.randomUUID().slice(0, 8);
let contadorRequisicoes = 0;

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

  // ── Cronometragem dentro da função (instrumentação — 1.3) ────────────────
  //
  // O cliente já mede a chamada inteira; o que ele NÃO consegue separar é o que
  // é rede e o que é servidor. Estes quatro números fecham a conta:
  //
  //   TTFB = latência de rede + boot do isolate + auth + conexão + query
  //
  // `auth` e `conexao` estão aqui, e não só o `total`, porque são os dois
  // suspeitos: a verificação de JWT busca o JWKS por rede num isolate frio, e o
  // `getSql()` faz `import()` de um módulo REMOTO (deno.land) antes de abrir a
  // conexão. Medir só o total diria "é servidor" sem dizer qual dos dois.
  //
  // `total` é medido até a montagem da resposta, então não inclui a volta pela
  // rede — que é justamente a parcela que a subtração no cliente revela.
  const t0 = performance.now();
  const marca = { auth: 0, conexao: 0, warmup: 0, query: 0 };
  const numeroReq = ++contadorRequisicoes;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        // `Server-Timing` é padrão e o DevTools o desenha dentro do painel
        // Timing da requisição — a repartição aparece ao lado de TTFB, sem
        // ninguém precisar somar nada à mão.
        "Server-Timing": [
          `auth;dur=${marca.auth.toFixed(1)}`,
          `conn;dur=${marca.conexao.toFixed(1)}`,
          `warmup;dur=${marca.warmup.toFixed(1)}`,
          `query;dur=${marca.query.toFixed(1)}`,
          `total;dur=${(performance.now() - t0).toFixed(1)}`,
        ].join(", "),
        // Boot e sequência num header próprio: o `desc` do Server-Timing seria
        // um lugar torto para um identificador, e o cliente precisa lê-lo para
        // contar quantos isolates distintos atenderam um salvamento.
        "X-Exec-Boot": `${BOOT_ID}:${numeroReq}`,
        // Sem isto o JS do navegador não enxerga nenhum dos dois: resposta
        // cross-origin só expõe os headers seguros por padrão. O DevTools
        // mostra de qualquer jeito; o shim, não.
        "Access-Control-Expose-Headers": "Server-Timing, X-Exec-Boot",
      },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Camada 1 — usuário autenticado E aprovado (anon key é rejeitada; conta
    // criada pelo signup público, sem aprovação de admin, leva 403 aqui).
    const tAuth = performance.now();
    const auth = await authenticate(req, "execute-sql");
    marca.auth = performance.now() - tAuth;
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

    console.log(
      `[execute-sql] boot=${BOOT_ID} req=${numeroReq} auth=${marca.auth.toFixed(0)}ms ` +
        `user=${userId} query: ${cleanQuery.substring(0, 120)}...`,
    );

    try {
      // Separados de propósito: `getSql()` só custa alguma coisa no isolate
      // FRIO (import remoto do postgres.js + handshake). Num isolate quente ele
      // é uma leitura de variável, e a diferença entre os dois casos é a
      // resposta da 1.2 medida em milissegundos em vez de lida em log.
      const tConexao = performance.now();
      const sql = await getSql();
      marca.conexao = performance.now() - tConexao;

      // ── SONDA DE HANDSHAKE (diagnóstico — remover quando decidir) ────
      //
      // O `getSql()` acima NÃO conecta: o cliente do postgres.js é preguiçoso e
      // só abre TCP, TLS, sessão com o Supavisor e startup na PRIMEIRA query.
      // Por isso `conn` mede quase nada (instanciar o objeto) e todo o
      // handshake caía carimbado como `query` — o que fazia um UPDATE de uma
      // linha parecer custar 736 ms de banco.
      //
      // Um `SELECT 1` antes da query real separa as duas coisas: ele paga o
      // handshake, e a query real passa a medir só a query. Num isolate quente
      // o `SELECT 1` é um round-trip de poucos ms; como 109 de 118 requisições
      // chegam frias, o custo marginal é praticamente zero.
      const tWarmup = performance.now();
      await sql.unsafe("SELECT 1");
      marca.warmup = performance.now() - tWarmup;

      const tQuery = performance.now();
      const result = await sql.unsafe(cleanQuery);
      marca.query = performance.now() - tQuery;

      console.log(
        `[execute-sql] boot=${BOOT_ID} req=${numeroReq} ` +
          `auth=${marca.auth.toFixed(0)}ms conn=${marca.conexao.toFixed(0)}ms ` +
          `warmup=${marca.warmup.toFixed(0)}ms query=${marca.query.toFixed(0)}ms ` +
          `total=${(performance.now() - t0).toFixed(0)}ms`,
      );

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
