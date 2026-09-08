/**
 * Compatibility shim for @uibakery/data
 * Routes SQL actions through Supabase Edge Function.
 *
 * ONDE MORA O ESCAPE — leia antes de mexer em `sanitiseParams`.
 *
 * O escape de aspas NÃO acontece aqui. Ele acontece no edge function
 * (`supabase/functions/execute-sql/sql-template.ts`), que é quem sabe em qual
 * dos três caminhos de interpolação o valor vai cair e, portanto, quem monta o
 * literal SQL — e a regra é que quem monta o literal é quem escapa.
 *
 * Este comentário já disse o contrário, e a frase era o próprio bug: enquanto o
 * shim escapava, o edge function escapava DE NOVO no caminho `{{params.chave}}`,
 * e todo texto com apóstrofo era gravado com a aspa dobrada — `Owner's Rep`
 * virava `Owner''s Rep`. Como o valor corrompido era relido e reescapado no
 * salvamento seguinte, as aspas dobravam a cada vez: 1 → 2 → 4 → 8.
 *
 * O que sobra aqui é a remoção do byte nulo, que não é escape de SQL: é higiene
 * de transporte, idempotente, e não conflita com nada.
 *
 * Ações auth-críticas podem optar por "SUPABASE_DIRECT" e passar ao largo do
 * edge function, usando o cliente Supabase com query parametrizada de verdade.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../src/integrations/supabase/client';

interface ActionConfig {
  databaseName: string;
  query: string;
}

interface ActionResult {
  _type: 'uibakery_action';
  name: string;
  actionType: string;
  config?: ActionConfig;
  /** Used by SUPABASE_DIRECT actions instead of a raw SQL string */
  directFn?: (params?: Record<string, any>) => Promise<any[]>;
}

// ─── Higiene de transporte ───────────────────────────────────────────────────
/**
 * Remove o byte nulo de todo valor string.
 *
 * NÃO escapa aspas — ver o cabeçalho do arquivo. O escape é do edge function,
 * porque só ele sabe se o valor vai entrar num literal que ele mesmo monta (e
 * então ele escapa) ou num fragmento SQL montado pela própria expressão do
 * template (e então ele escapa antes de entregar o valor à expressão).
 *
 * Escapar aqui, como se fazia, dobrava a aspa no primeiro caso e corrompia o
 * dado em silêncio. Não devolva o `.replace(/'/g, "''")` para cá.
 */
function sanitiseParams(params: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      out[k] = v.replace(/\x00/g, '');
    } else {
      out[k] = v;
    }
  }
  return out;
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an action descriptor (replaces @uibakery/data's `action`)
 */
export function action(name: string, type: string, config: ActionConfig): ActionResult {
  return { _type: 'uibakery_action', name, actionType: type, config };
}

/**
 * Creates a SUPABASE_DIRECT action that bypasses the edge function entirely.
 * Use this for auth-critical or write operations where SQL injection is
 * unacceptable.
 */
export function directAction(
  name: string,
  fn: (params?: Record<string, any>) => Promise<any[]>,
): ActionResult {
  return { _type: 'uibakery_action', name, actionType: 'SUPABASE_DIRECT', directFn: fn };
}

// ─── Observador de requisições (instrumentação) ──────────────────────────────
/**
 * Callback opcional notificado a CADA requisição concluída, com o nome da ação e
 * a duração em milissegundos.
 *
 * Existe para o cronômetro de salvamento da Modelagem Financeira medir sem que
 * cada chamada precise ser embrulhada à mão: o `salvar()` faz dezenas de
 * chamadas por dezenas de ações diferentes, e envolver uma a uma daria uma
 * contagem que sai do lugar assim que alguém acrescentar uma action nova.
 * Medindo aqui, no ponto por onde TODA requisição passa, a conta não tem como
 * divergir do que de fato foi para a rede.
 *
 * Fora de uma medição o observador é `null` e o custo é uma comparação por
 * requisição — nada é cronometrado e nada é alocado.
 */
type ObservadorRequisicao = (nome: string, ms: number, erro: boolean) => void;

let observador: ObservadorRequisicao | null = null;

/** Liga o observador; passe `null` para desligar. Devolve o anterior. */
export function observarRequisicoes(fn: ObservadorRequisicao | null): ObservadorRequisicao | null {
  const anterior = observador;
  observador = fn;
  return anterior;
}

/**
 * Executes an action (SQL via edge function or direct Supabase call)
 */
async function executeAction(actionResult: ActionResult, params?: Record<string, any>): Promise<any[]> {
  // Medição em UMA função só, em vez de embrulhar a original noutra: sem
  // observador, o custo é uma verificação de verdade e uma atribuição de zero.
  const obs = observador;
  const inicio = obs ? performance.now() : 0;
  let falhou = false;
  try {
    // SUPABASE_DIRECT: bypass edge function, use parameterised Supabase queries
    //
    // `return await`, e não `return`: sem o await a promessa escapa do try e o
    // `finally` roda ANTES de a consulta responder — o observador receberia
    // zero milissegundo para toda ação direta, e `falhou` ficaria falso mesmo
    // numa que estourasse. Nenhuma action da modelagem é direta, então o
    // relatório de salvamento nunca viu esse zero; as seis que são (auditoria e
    // fornecedor subcontratado) viam, e mediriam errado no dia em que alguém
    // cronometrasse aquelas telas.
    if (actionResult.actionType === 'SUPABASE_DIRECT' && actionResult.directFn) {
      return await actionResult.directFn(params);
    }

    if (!actionResult.config) {
      throw new Error(`[Action ${actionResult.name}] Missing config for SQL action`);
    }

    const safeParams = params ? sanitiseParams(params) : {};

    const { data, error } = await supabase.functions.invoke('execute-sql', {
      body: {
        query: actionResult.config.query,
        params: safeParams,
      },
    });

    if (error) {
      throw new Error(error.message || 'Edge function error');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.data || [];
  } catch (e) {
    falhou = true;
    throw e;
  } finally {
    if (obs) obs(actionResult.name, performance.now() - inicio, falhou);
  }
}

/**
 * Hook that loads data on mount (replaces @uibakery/data's `useLoadAction`)
 * Signature: useLoadAction(actionFn, defaultValue, params?)
 * Returns: [data, loading, error, refresh]
 */
export function useLoadAction(
  actionFn: () => ActionResult,
  defaultValue: any[] = [],
  params?: Record<string, any>,
): [any, boolean, any, () => void] {
  const [data, setData] = useState<any>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const mountedRef = useRef(true);

  const paramsKey = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const actionResult = actionFn();
      const result = await executeAction(actionResult, params);
      if (mountedRef.current) setData(result);
    } catch (err: any) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return [data, loading, error, load];
}

/**
 * Hook that returns a mutation function (replaces @uibakery/data's `useMutateAction`)
 * Signature: useMutateAction(actionFn)
 * Returns: [mutate, isLoading]
 */
export function useMutateAction(
  actionFn: () => ActionResult,
): [(params?: Record<string, any>) => Promise<any>, boolean] {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (params?: Record<string, any>) => {
      setIsLoading(true);
      try {
        const actionResult = actionFn();
        return await executeAction(actionResult, params);
      } finally {
        setIsLoading(false);
      }
    },
    [actionFn],
  );

  return [mutate, isLoading];
}
