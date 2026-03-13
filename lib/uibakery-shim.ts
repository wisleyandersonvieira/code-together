/**
 * Compatibility shim for @uibakery/data
 * Routes SQL actions through Supabase Edge Function
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActionConfig {
  databaseName: string;
  query: string;
}

interface ActionResult {
  _type: 'uibakery_action';
  name: string;
  actionType: string;
  config: ActionConfig;
}

/**
 * Creates an action descriptor (replaces @uibakery/data's `action`)
 */
export function action(name: string, type: string, config: ActionConfig): ActionResult {
  return {
    _type: 'uibakery_action',
    name,
    actionType: type,
    config,
  };
}

/**
 * Executes a SQL action via Supabase Edge Function
 */
async function executeAction(actionResult: ActionResult, params?: Record<string, any>): Promise<any[]> {
  const { data, error } = await supabase.functions.invoke('execute-sql', {
    body: {
      query: actionResult.config.query,
      params: params || {},
    },
  });

  if (error) {
    console.error(`[Action ${actionResult.name}] Edge function error:`, error);
    throw new Error(error.message || 'Edge function error');
  }

  if (data?.error) {
    console.error(`[Action ${actionResult.name}] SQL error:`, data.error);
    throw new Error(data.error);
  }

  return data?.data || [];
}

/**
 * Hook that loads data on mount (replaces @uibakery/data's `useLoadAction`)
 * Signature: useLoadAction(actionFn, defaultValue, params?)
 * Returns: [data, loading, error, refresh]
 */
export function useLoadAction(
  actionFn: () => ActionResult,
  defaultValue: any[] = [],
  params?: Record<string, any>
): [any, boolean, any, () => void] {
  const [data, setData] = useState<any>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const paramsRef = useRef(params);
  const mountedRef = useRef(true);

  // Track if params actually changed
  const paramsKey = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const actionResult = actionFn();
      const result = await executeAction(actionResult, params);
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err);
        console.error('[useLoadAction] Error:', err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
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
  actionFn: () => ActionResult
): [(params?: Record<string, any>) => Promise<any>, boolean] {
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(async (params?: Record<string, any>) => {
    setIsLoading(true);
    try {
      const actionResult = actionFn();
      const result = await executeAction(actionResult, params);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [actionFn]);

  return [mutate, isLoading];
}
