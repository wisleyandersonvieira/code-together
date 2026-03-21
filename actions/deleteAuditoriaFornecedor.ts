import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function deleteAuditoriaFornecedor() {
  return directAction('deleteAuditoriaFornecedor', async (params) => {
    const { error } = await (supabase as any).rpc('delete_auditoria_fornecedor', {
      p_auditoria_id: params?.id,
    });

    if (error) {
      throw error;
    }

    return [];
  });
}

export default deleteAuditoriaFornecedor;
