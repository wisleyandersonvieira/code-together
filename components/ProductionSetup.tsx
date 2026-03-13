import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Database, Settings } from 'lucide-react';
import testSupabaseConnection from '@/actions/testSupabaseConnection';
import applySupabaseStructure from '@/actions/applySupabaseStructure';
import insertSupabaseDefaults from '@/actions/insertSupabaseDefaults';

export function ProductionSetup() {
  const [connectionData, loading, error] = useLoadAction(testSupabaseConnection, []);
  const [applyStructure, applyLoading] = useMutateAction(applySupabaseStructure);
  const [insertDefaults, insertLoading] = useMutateAction(insertSupabaseDefaults);
  const [step, setStep] = useState<'check' | 'structure' | 'data' | 'complete'>('check');

  const handleSetupProduction = async () => {
    try {
      setStep('structure');
      await applyStructure({});
      
      setStep('data');
      await insertDefaults({});
      
      setStep('complete');
    } catch (error) {
      console.error('Erro no setup:', error);
    }
  };

  const isReady = connectionData && connectionData.tables_created >= 4;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Setup de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>Status da Conexão com Banco:</span>
            {loading && <span className="text-yellow-600">Verificando...</span>}
            {error && <AlertCircle className="h-4 w-4 text-red-500" />}
            {connectionData && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>

          {connectionData && (
            <div className="bg-gray-50 p-3 rounded space-y-2">
              <p><strong>Tabelas criadas:</strong> {connectionData.tables_created}/4</p>
              <p><strong>Colunas Kanban:</strong> {connectionData.kanban_columns_count}</p>
              <p><strong>Projetos:</strong> {connectionData.projetos_count}</p>
            </div>
          )}

          {!isReady && !loading && !error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Banco de dados não configurado. Execute o setup abaixo.
              </AlertDescription>
            </Alert>
          )}

          {!isReady && (
            <Button 
              onClick={handleSetupProduction}
              disabled={applyLoading || insertLoading}
              className="w-full"
            >
              {step === 'structure' && 'Criando estrutura...'}
              {step === 'data' && 'Inserindo dados padrão...'}
              {step === 'complete' && 'Configuração completa!'}
              {step === 'check' && 'Configurar Produção'}
            </Button>
          )}

          {isReady && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                ✅ Aplicação pronta para produção!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist de Deploy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>✅ Código React pronto</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>✅ Ações configuradas</span>
            </div>
            <div className="flex items-center gap-2">
              {isReady ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span>{isReady ? '✅' : '⏳'} Banco de dados configurado</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>✅ Migrações prontas</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
