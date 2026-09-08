import { directAction } from '@uibakery/data';
import { supabase } from '@/src/integrations/supabase/client';

/**
 * Salva a modelagem inteira numa chamada.
 *
 * SUPABASE_DIRECT, e por um motivo que é o ponto todo desta ação: o `rpc()` vai
 * pelo PostgREST, e o PostgREST NÃO é o execute-sql.
 *
 * O execute-sql é uma edge function — isolate efêmero, reciclado quase a cada
 * requisição (110 boots distintos em 118 chamadas de um salvamento). O cliente
 * do postgres.js lá dentro é preguiçoso: TCP, TLS, sessão com o Supavisor e
 * startup só acontecem na PRIMEIRA query do isolate. Resultado medido em
 * produção: ~736 ms por requisição, quase tudo handshake carimbado como tempo
 * de query.
 *
 * O PostgREST é processo permanente com pool aberto. Um handshake em vez de 118.
 *
 * Por isso esta ação não pode virar uma action SQL comum: mandá-la pelo
 * execute-sql devolveria exatamente o custo que ela existe para eliminar.
 */
function salvarModelagem() {
  return directAction('salvarModelagem', async (params) => {
    const { data, error } = await (supabase as any).rpc('salvar_modelagem', {
      p_payload: params?.payload ?? {},
    });
    if (error) throw new Error(error.message);
    // O shim espera uma lista; a função devolve um objeto jsonb. Embrulhar aqui
    // mantém `executeAction` com um contrato só para os dois caminhos.
    return [data];
  });
}

export default salvarModelagem;
