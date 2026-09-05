/**
 * Interpolação de template e guarda de statements do `execute-sql`.
 *
 * Vive fora do `index.ts` por um motivo específico: é o código de SEGURANÇA da
 * função, e enquanto estava embutido num módulo que faz `Deno.serve` no topo não
 * havia como executá-lo num teste. O bug do escape duplo (corrupção silenciosa
 * de todo texto com apóstrofo) sobreviveu meses exatamente por isso.
 *
 * Nada aqui usa API do Deno nem import remoto: é TypeScript puro, importável
 * tanto pela função quanto pelo vitest do app.
 */

export const ALLOWED_FIRST_TOKENS = ["SELECT", "WITH", "INSERT", "UPDATE", "DELETE"];

export const FORBIDDEN = [
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
export function scrub(query: string): string {
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

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function guardStatement(query: string): GuardResult {
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

/**
 * Cópia dos parâmetros com as strings prontas para entrar CRUAS dentro de um
 * literal SQL: apóstrofo dobrado e byte nulo removido.
 *
 * Serve só à expressão complexa SEM aspas — a única que devolve texto cru para
 * dentro do SQL. Ver `processTemplate`.
 */
function escaparStrings(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = typeof v === "string" ? v.replace(/\x00/g, "").replace(/'/g, "''") : v;
  }
  return out;
}

/**
 * Interpola os `{{…}}` de uma query no estilo UIBakery.
 *
 *   - Simples:  {{params.chave}}
 *   - Complexo: {{ params && params.x ? "SQL … " + params.x + " …" : "" }}
 *
 * ─── UM ESCAPE POR CAMINHO, E OS DOIS AQUI ─────────────────────────────────
 *
 * Os dois ramos põem valor de usuário dentro de SQL, mas de formas diferentes, e
 * é daí que vinha o bug:
 *
 *   - o ramo SIMPLES monta o literal ele mesmo (`'…'`), então escapa ele mesmo;
 *   - o ramo COMPLEXO devolve `String(result)` CRU — o fragmento SQL já vem
 *     montado pela expressão, com o valor concatenado lá dentro. Quem escapa
 *     tem de ser quem entrega o valor à expressão.
 *
 * E o ramo complexo tem DOIS casos, que é onde a análise inicial deste bug
 * parou: quando o `{{…}}` está entre aspas simples no template, quem monta o
 * literal é este código (`'${String(result)…}'`) e ele já escapa o resultado —
 * então a expressão precisa receber os params CRUS, ou o valor é escapado duas
 * vezes de novo. Quando não está entre aspas, o resultado entra cru e a expressão
 * precisa dos params escapados.
 *
 * A regra, portanto, é por CAMINHO e não por ramo:
 *
 *   quem monta o literal é quem escapa.
 *
 *   - ramo simples                  → este código monta  → params crus
 *   - complexo ENTRE aspas          → este código monta  → params crus
 *   - complexo SEM aspas            → a expressão monta  → params escapados
 *
 * Cada valor é escapado EXATAMENTE UMA VEZ, caia onde cair.
 *
 * Antes desta correção o escape morava no cliente (`sanitiseParams`, no shim) e
 * valia para os dois ramos: o complexo ficava certo e o simples escapava DUAS
 * vezes — uma no cliente, outra aqui —, gravando `Owner''s Rep`. E como o valor
 * corrompido era relido e reescapado, as aspas dobravam a cada salvamento.
 *
 * O escape NÃO pode voltar para o cliente: o ramo complexo devolve texto cru
 * para dentro do SQL, e um cliente que não escapasse (ou uma chamada que não
 * passasse pelo shim) abriria injeção nos campos de busca.
 */
export function processTemplate(query: string, params: Record<string, unknown>): string {
  // Só materializa a cópia escapada se houver ramo complexo — a esmagadora
  // maioria das queries do app tem apenas `{{params.chave}}`.
  let escapados: Record<string, unknown> | null = null;
  const paramsEscapados = () => (escapados ??= escaparStrings(params));

  return query.replace(/'?\{\{([\s\S]*?)\}\}'?/g, (_match: string, expr: string) => {
    const trimmed = expr.trim();
    const wrappedInQuotes = _match.startsWith("'") && _match.endsWith("'");

    // ─── Ramo simples: params.chave, params.chave::tipo ───────────────────
    // Monta o literal aqui, então escapa aqui. Inalterado pela correção.
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

    // ─── Ramo complexo ────────────────────────────────────────────────────
    // O resultado volta CRU para dentro do SQL, então a expressão precisa
    // receber os valores JÁ escapados.
    try {
      const fn = new Function(
        "params",
        `
        try {
          return (${trimmed});
        } catch(e) {
          return "";
        }
      `,
      );
      // Entre aspas, o literal é montado LOGO ABAIXO e o escape acontece lá:
      // mandar params já escapados aqui dobraria as aspas de novo — foi assim
      // que `updateConta` e `updateContaPagar` vinham corrompendo texto.
      const result: unknown = fn(wrappedInQuotes ? params : paramsEscapados());
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
}
