import { directAction } from '@uibakery/data';
import { supabase } from '../src/integrations/supabase/client';

function authenticateUser() {
  return directAction('authenticateUser', async (params) => {
    const email = params?.email as string | undefined;
    const password = params?.password as string | undefined;
    if (!email || !password) return [];

    const { data, error } = await supabase.functions.invoke('auth-login', {
      body: {
        email,
        password,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return data?.data ?? [];
  });
}

export default authenticateUser;
