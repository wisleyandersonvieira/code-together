/**
 * CORS compartilhado pelas edge functions.
 *
 * ALLOWED_ORIGIN aceita uma LISTA separada por vírgula, porque o header
 * Access-Control-Allow-Origin só comporta um valor por resposta — com mais de
 * um domínio é preciso refletir a origem da requisição. Ex.:
 *
 *   ALLOWED_ORIGIN="https://provison.com.br,https://www.provison.com.br"
 *
 * Sem a secret definida, caímos em '*' (qualquer origem) — fallback temporário.
 */
const rawAllowed = Deno.env.get("ALLOWED_ORIGIN");

const ALLOWED_ORIGINS = (rawAllowed ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  console.warn(
    "[cors] ALLOWED_ORIGIN não configurada — usando '*' (qualquer origem). " +
      "Defina a secret ALLOWED_ORIGIN com os domínios de produção do app.",
  );
}

const BASE_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

/**
 * Headers de CORS para uma requisição específica: reflete a origem quando ela
 * está na lista permitida. Origem desconhecida recebe o primeiro domínio da
 * lista, o que faz o navegador bloquear a resposta.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  if (ALLOWED_ORIGINS.length === 0) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": "*" };
  }

  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return { ...BASE_HEADERS, "Access-Control-Allow-Origin": allowed };
}

/**
 * Headers estáticos, mantidos para as funções que NÃO são chamadas pelo
 * navegador (auth-login, password-reset, migrate-users — nenhuma tela as
 * importa hoje). Para qualquer função chamada do browser use corsHeadersFor(req).
 */
export const corsHeaders = {
  ...BASE_HEADERS,
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] ?? "*",
};
