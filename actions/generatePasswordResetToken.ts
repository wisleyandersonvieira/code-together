import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function generatePasswordResetToken() {
  return directAction('generatePasswordResetToken', async (params) => {
    const email = params?.email as string | undefined;
    if (!email) return [];

    const { data, error } = await supabase.functions.invoke('password-reset', {
      body: {
        mode: 'request',
        email,
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return data?.data ?? [];
  });
}

export default generatePasswordResetToken;
