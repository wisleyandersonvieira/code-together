/**
 * Compatibility shim for @uibakery/data
 * Routes SQL actions through Supabase Edge Function.
 *
 * Security layer: all string params are sanitised before being sent to the
 * edge function (escape single-quotes, strip null bytes).  Complex or
 * auth-critical actions can opt-in to "SUPABASE_DIRECT" to bypass the edge
 * function entirely and use the Supabase JS client with proper parameterised
 * queries.
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

// ─── SQL injection mitigation ────────────────────────────────────────────────
/**
 * Escape every string value in a params map so single-quotes and null bytes
 * cannot escape the surrounding SQL literal that the edge function builds.
 * This is a defence-in-depth measure; the edge function execute-sql applies a
 * statement guard on top of it (single statement, allow-list of commands).
 */
function sanitiseParams(params: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      out[k] = v.replace(/\x00/g, '').replace(/'/g, "''");
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
    if (actionResult.actionType === 'SUPABASE_DIRECT' && actionResult.directFn) {
      return actionResult.directFn(params);
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
