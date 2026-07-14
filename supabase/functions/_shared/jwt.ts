/**
 * Verificação LOCAL de JWT do Supabase (GoTrue), compartilhada pelas edge
 * functions que exigem usuário autenticado.
 *
 * A assinatura é conferida contra o JWKS do projeto (ES256), sem chamada de
 * rede ao GoTrue a cada requisição. Isso desacopla a autorização do estado de
 * sessão no servidor: a abordagem anterior (auth.getUser) exigia que a SESSÃO
 * ainda existisse, e qualquer revogação derrubava todas as telas do app de uma
 * vez, além de custar um round-trip por query.
 *
 * Trade-off consciente: um token cuja sessão foi revogada continua aceito até o
 * seu `exp` (no máximo 1h, o TTL do access token do projeto).
 */
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "https://esm.sh/jose@5.9.6";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const ISSUER = `${SUPABASE_URL}/auth/v1`;
const JWKS_URL = new URL(`${ISSUER}/.well-known/jwks.json`);
const JWKS_TTL_MS = 10 * 60 * 1000;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCreatedAt = 0;
const knownKids = new Set<string>();

/** Recria o JWKS a cada TTL (o jose cacheia as chaves internamente). */
function getJwks(forceRefresh = false) {
  const expired = Date.now() - jwksCreatedAt > JWKS_TTL_MS;
  if (!jwks || expired || forceRefresh) {
    jwks = createRemoteJWKSet(JWKS_URL, { cacheMaxAge: JWKS_TTL_MS });
    jwksCreatedAt = Date.now();
    knownKids.clear();
  }
  return jwks!;
}

/** Nunca logar o token inteiro: só o suficiente para correlacionar. */
function safeToken(token: string): string {
  return `${token.slice(0, 12)}…${token.slice(-6)} (len=${token.length})`;
}

export type AuthResult =
  | { userId: string; email?: string }
  | { error: string };

export function isAuthError(r: AuthResult): r is { error: string } {
  return "error" in r;
}

export async function authenticate(req: Request, tag = "auth"): Promise<AuthResult> {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.warn(`[${tag}] Authorization header ausente`);
    return { error: "Authorization header ausente" };
  }

  const token = match[1].trim();

  let kid: string | undefined;
  try {
    kid = decodeProtectedHeader(token).kid;
  } catch {
    console.warn(`[${tag}] JWT malformado — ${safeToken(token)}`);
    return { error: "Token malformado" };
  }

  // kid desconhecido pode indicar rotação de chave: força refetch do JWKS.
  const forceRefresh = !!kid && knownKids.size > 0 && !knownKids.has(kid);

  const verify = (keys: ReturnType<typeof createRemoteJWKSet>) =>
    jwtVerify(token, keys, {
      issuer: ISSUER,
      algorithms: ["ES256"],
      // clockTolerance default = 0: o exp é conferido de verdade.
    });

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await verify(getJwks(forceRefresh)));
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";

    if (code === "ERR_JWT_EXPIRED") {
      console.warn(`[${tag}] token expirado — ${safeToken(token)}`);
      return { error: "Token expirado" };
    }

    // Chave ausente do JWKS em cache: tenta uma vez com o JWKS fresco.
    if (code === "ERR_JWKS_NO_MATCHING_KEY" && !forceRefresh) {
      try {
        ({ payload } = await verify(getJwks(true)));
      } catch (retryErr) {
        const retryCode = (retryErr as { code?: string })?.code ?? "?";
        console.warn(`[${tag}] assinatura inválida após refetch do JWKS (${retryCode}) — ${safeToken(token)}`);
        return { error: "Assinatura inválida" };
      }
    } else {
      const msg = code || (err as Error)?.message;
      console.warn(`[${tag}] verificação falhou (${msg}) — ${safeToken(token)}`);
      return { error: "Assinatura inválida ou issuer incorreto" };
    }
  }

  if (kid) knownKids.add(kid);

  // anon key e service key são JWTs válidos deste projeto, mas nenhuma das duas
  // representa um usuário logado.
  const role = payload.role;
  if (role !== "authenticated") {
    console.warn(`[${tag}] role '${String(role)}' não é 'authenticated' — ${safeToken(token)}`);
    return { error: `Role '${String(role)}' não representa um usuário autenticado` };
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  if (!userId) {
    console.warn(`[${tag}] JWT sem claim sub — ${safeToken(token)}`);
    return { error: "Token sem identificação de usuário" };
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;
  return { userId, email };
}
