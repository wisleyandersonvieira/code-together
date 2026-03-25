import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function resetPassword() {
  return directAction('resetPassword', async (params) => {
    const token = params?.token as string | undefined;
    const password = params?.password as string | undefined;
    if (!token || !password) return [];

    const { data, error } = await supabase.functions.invoke('password-reset', {
      body: {
        mode: 'reset',
        token,
        password,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return data?.data ?? [];
  });
}

export default resetPassword;
