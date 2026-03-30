import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch all active users from legacy table
    const { data: legacyUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, status')
      .eq('status', 'active');

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ email: string; status: string; error?: string }> = [];

    for (const user of legacyUsers || []) {
      if (!user.email) continue;

      // Check if user already exists in auth
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const alreadyMigrated = existingUsers?.users?.some(
        (u) => u.email?.toLowerCase() === user.email.toLowerCase()
      );

      if (alreadyMigrated) {
        results.push({ email: user.email, status: 'already_migrated' });
        continue;
      }

      // Create user in Supabase Auth with a temporary password
      // User will need to reset password via email
      const tempPassword = crypto.randomUUID() + 'Aa1!';
      const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role || 'user',
        },
      });

      if (createError) {
        results.push({ email: user.email, status: 'error', error: createError.message });
        continue;
      }

      // Update profile with legacy data
      if (authUser?.user) {
        await supabase
          .from('profiles')
          .update({
            name: user.name,
            phone: user.phone,
            role: user.role || 'user',
            status: user.status || 'active',
            legacy_user_id: user.id,
          })
          .eq('id', authUser.user.id);
      }

      results.push({ email: user.email, status: 'migrated' });
    }

    return new Response(
      JSON.stringify({ data: results }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro ao migrar usuários' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
