import { corsHeaders } from '../_shared/cors.ts';
import {
  createResetToken,
  getSqlClient,
  hashPassword,
  sanitiseEmail,
  type PublicUser,
} from '../_shared/auth-utils.ts';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let sql: Awaited<ReturnType<typeof getSqlClient>> | null = null;

  try {
    const { mode, email, token, password } = await req.json();

    sql = await getSqlClient();

    if (mode === 'request') {
      if (typeof email !== 'string') {
        return response({ error: 'Email inválido.' }, 400);
      }

      const resetToken = createResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const users = await sql<PublicUser[]>`
        UPDATE users
        SET password_reset_token = ${resetToken},
            password_reset_expires = ${expiresAt}
        WHERE LOWER(email) = ${sanitiseEmail(email)}
          AND status = 'active'
        RETURNING id, name, email, role, status
      `;

      const debugToken =
        Deno.env.get('AUTH_DEBUG_RESET_TOKEN') === 'true' && users.length > 0
          ? resetToken
          : undefined;

      return response({
        data: [
          {
            accepted: true,
            debugToken,
          },
        ],
      });
    }

    if (mode === 'reset') {
      if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8) {
        return response({ error: 'Token ou senha inválidos.' }, 400);
      }

      const passwordHash = await hashPassword(password);

      const users = await sql<PublicUser[]>`
        UPDATE users
        SET password_hash = ${passwordHash},
            password_reset_token = NULL,
            password_reset_expires = NULL
        WHERE password_reset_token = ${token}
          AND password_reset_expires > CURRENT_TIMESTAMP
        RETURNING id, name, email, role, status
      `;

      if (users.length === 0) {
        return response({ error: 'Token inválido ou expirado.' }, 400);
      }

      return response({
        data: [
          {
            success: true,
          },
        ],
      });
    }

    return response({ error: 'Modo inválido.' }, 400);
  } catch {
    return response({ error: 'Falha ao processar a recuperação de senha.' }, 500);
  } finally {
    if (sql) {
      try {
        await sql.end({ timeout: 3 });
      } catch {
        // Ignore close errors in the edge runtime.
      }
    }
  }
});
