import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

function createFornecedorSubcontratado() {
  return directAction('createFornecedorSubcontratado', async (params) => {
    const payload = {
      nome_razao_social: params?.nome_razao_social,
      nome_fantasia: params?.nome_fantasia || null,
      cpf_cnpj: params?.cpf_cnpj,
      telefone: params?.telefone || null,
      email: params?.email || null,
      contato_responsavel: params?.contato_responsavel || null,
      observacoes: params?.observacoes || null,
      status: params?.status || 'ativo',
    };

    const { data, error } = await (supabase as any)
      .from('fornecedores_subcontratados')
      .insert(payload)
      .select('*');

    if (error) {
      throw error;
    }

    return data || [];
  });
}

export default createFornecedorSubcontratado;
