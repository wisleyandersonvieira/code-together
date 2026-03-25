import { corsHeaders } from '../_shared/cors.ts';
import {
  getSqlClient,
  jsonResponse,
  sanitiseEmail,
  sleep,
  toPublicUser,
  verifyPassword,
  type AppUserRecord,
} from '../_shared/auth-utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let sql: Awaited<ReturnType<typeof getSqlClient>> | null = null;

  try {
    const { email, password } = await req.json();

    if (typeof email !== 'string' || typeof password !== 'string') {
      return jsonResponse(
        { error: 'Email e senha são obrigatórios.' },
        400,
      );
    }

    const normalisedEmail = sanitiseEmail(email);
    if (!normalisedEmail || password.length < 1) {
      return jsonResponse(
        { error: 'Credenciais inválidas.' },
        400,
      );
    }

    sql = await getSqlClient();

    const users = await sql<AppUserRecord[]>`
      SELECT id, name, email, role, status, password_hash
      FROM users
      WHERE LOWER(email) = ${normalisedEmail}
        AND status = 'active'
      LIMIT 1
    `;

    const user = users[0];
    const passwordOk = await verifyPassword(password, user?.password_hash ?? null);

    if (!user || !passwordOk) {
      await sleep(250);
      return jsonResponse(
        { error: 'Email ou senha inválidos.' },
        401,
      );
    }

    await sql`
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

    return new Response(
      JSON.stringify({ data: [toPublicUser(user)] }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Falha ao autenticar usuário.' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
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
