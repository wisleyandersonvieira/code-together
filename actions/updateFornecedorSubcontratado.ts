import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function updateFornecedorSubcontratado() {
  return directAction('updateFornecedorSubcontratado', async (params) => {
    const payload = {
      nome_razao_social: params?.nome_razao_social,
      nome_fantasia: params?.nome_fantasia || null,
      cpf_cnpj: params?.cpf_cnpj,
      telefone: params?.telefone || null,
      email: params?.email || null,
      contato_responsavel: params?.contato_responsavel || null,
      observacoes: params?.observacoes || null,
      status: params?.status || 'ativo',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from('fornecedores_subcontratados')
      .update(payload)
      .eq('id', params?.id)
      .select('*');

    if (error) {
      throw error;
    }

    return data || [];
  });
}

export default updateFornecedorSubcontratado;
