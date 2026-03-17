'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight connection check using the Supabase REST API directly,
 * avoiding an extra edge function call on every page load.
 */
export function DatabaseConnectionStatus() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('parametros').select('id').limit(1);
      if (err) setError(err.message);
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (loading && !isRetrying) {
      const timer = setTimeout(() => setShowLoading(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [loading, isRetrying]);

  const handleRetry = () => {
    setIsRetrying(true);
    checkConnection().finally(() => setIsRetrying(false));
  };

  if (loading && !isRetrying && showLoading) {
    return (
      <Alert>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <AlertTitle>Verificando conexão...</AlertTitle>
        <AlertDescription>
          A conexão está demorando mais que o esperado. Aguarde...
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    const isConnectionReset = error.includes('connection was reset') || 
                              error.includes('can\'t be reached') ||
                              error.includes('ECONNRESET') ||
                              error.includes('ETIMEDOUT');

    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro de Conexão com o Banco de Dados</AlertTitle>
        <AlertDescription>
          <div className="space-y-2">
            <p>
              {isConnectionReset 
                ? 'A conexão com o banco de dados foi perdida.'
                : 'Erro ao conectar:'}
            </p>
            {!isConnectionReset && (
              <p className="text-sm font-mono bg-muted p-2 rounded">{error}</p>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              disabled={isRetrying}
              className="mt-2"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Reconectando...' : 'Tentar Novamente'}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
