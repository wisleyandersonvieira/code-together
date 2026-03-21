import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function toggleFornecedorSubcontratadoStatus() {
  return directAction('toggleFornecedorSubcontratadoStatus', async (params) => {
    const { data, error } = await (supabase as any)
      .from('fornecedores_subcontratados')
      .update({
        status: params?.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params?.id)
      .select('*');

    if (error) {
      throw error;
    }

    return data || [];
  });
}

export default toggleFornecedorSubcontratadoStatus;
