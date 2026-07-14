/**
 * CORS compartilhado pelas edge functions.
 *
 * Configure a secret ALLOWED_ORIGIN com o domínio de produção do app
 * (ex.: https://app.seudominio.com.br). Enquanto ela não estiver definida,
 * caímos em '*' — o que permite que QUALQUER site chame estas funções com o
 * token do usuário logado. É um fallback temporário, não o estado final.
 */
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");

if (!allowedOrigin) {
  console.warn(
    "[cors] ALLOWED_ORIGIN não configurada — usando '*' (qualquer origem). " +
      "Defina a secret ALLOWED_ORIGIN com o domínio de produção do app.",
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};
