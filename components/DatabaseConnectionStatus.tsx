'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLoadAction } from '@uibakery/data';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import loadParametrosAction from '@/actions/loadParametros';

export function DatabaseConnectionStatus() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  
  // @ts-ignore - useLoadAction supports 4th arg at runtime
  const [parametros, loading, error, reload] = useLoadAction(
    loadParametrosAction,
    [],
    {},
    retryKey
  );

  const handleRetry = () => {
    setIsRetrying(true);
    setRetryKey(prev => prev + 1);
    setTimeout(() => {
      reload();
      setIsRetrying(false);
    }, 1000);
  };

  // Só mostra loading se estiver demorando mais de 2 segundos
  const [showLoading, setShowLoading] = useState(false);
  
  useEffect(() => {
    if (loading && !isRetrying) {
      const timer = setTimeout(() => setShowLoading(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [loading, isRetrying]);

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
    const errorMessage = String(error);
    const isConnectionReset = errorMessage.includes('connection was reset') || 
                              errorMessage.includes('can\'t be reached') ||
                              errorMessage.includes('ECONNRESET') ||
                              errorMessage.includes('ETIMEDOUT');

    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro de Conexão com o Banco de Dados</AlertTitle>
        <AlertDescription>
          <div className="space-y-2">
            <p>
              {isConnectionReset 
                ? 'A conexão com o banco de dados foi perdida. Isso pode acontecer por:'
                : 'Erro ao conectar:'}
            </p>
            {isConnectionReset && (
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>Timeout de conexão (banco sobrecarregado)</li>
                <li>Banco de dados reiniciando</li>
                <li>Problema temporário de rede</li>
                <li>Limite de conexões atingido</li>
              </ul>
            )}
            {!isConnectionReset && (
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">{errorMessage}</p>
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

  // Só mostra algo quando há erro ou está carregando
  // Quando está OK, não mostra nada
  return null;
}
