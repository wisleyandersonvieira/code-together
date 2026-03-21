import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function deleteFornecedorSubcontratado() {
  return directAction('deleteFornecedorSubcontratado', async (params) => {
    const { error } = await (supabase as any)
      .from('fornecedores_subcontratados')
      .delete()
      .eq('id', params?.id);

    if (error) {
      throw error;
    }

    return [];
  });
}

export default deleteFornecedorSubcontratado;
