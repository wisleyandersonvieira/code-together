import { directAction } from '@uibakery/data';
import { supabase } from '@/integrations/supabase/client';

/**
 * Authenticates a user by email using a parameterised Supabase query.
 * Migrated from raw SQL template string to SUPABASE_DIRECT to eliminate
 * the SQL injection vector that existed in the edge-function shim.
 */
function authenticateUser() {
  return directAction('authenticateUser', async (params) => {
    const email = params?.email as string | undefined;
    if (!email) return [];

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, status, password_hash')
      .eq('email', email)
      .eq('status', 'active')
      .limit(1);

    if (error) throw new Error(error.message);
    return data ?? [];
  });
}

export default authenticateUser;
