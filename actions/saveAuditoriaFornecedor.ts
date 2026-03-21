import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function saveAuditoriaFornecedor() {
  return directAction('saveAuditoriaFornecedor', async (params) => {
    const { data, error } = await (supabase as any).rpc('save_auditoria_fornecedor', {
      p_payload: params?.payload,
      p_user_id: params?.userId ?? null,
    });

    if (error) {
      throw error;
    }

    return [{ data }];
  });
}

export default saveAuditoriaFornecedor;
