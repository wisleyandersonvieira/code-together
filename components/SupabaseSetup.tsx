import { useState } from 'react';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, CheckCircle, AlertTriangle, Play } from 'lucide-react';
import testSupabaseConnection from '@/actions/testSupabaseConnection';
import applySupabaseStructure from '@/actions/applySupabaseStructure';
import insertSupabaseDefaults from '@/actions/insertSupabaseDefaults';

export function SupabaseSetup() {
  const [connectionData, loading, error] = useLoadAction(testSupabaseConnection, []);
  const [applyStructure, applyLoading, applyError] = useMutateAction(applySupabaseStructure);
  const [insertDefaults, insertLoading, insertError] = useMutateAction(insertSupabaseDefaults);
  
  const [step, setStep] = useState<'check' | 'creating' | 'inserting' | 'complete'>('check');

  const handleSetupSupabase = async () => {
    try {
      setStep('creating');
      console.log('Criando estrutura de tabelas...');
      await applyStructure({});
      
      setStep('inserting');
      console.log('Inserindo dados padrão...');
      await insertDefaults({});
      
      setStep('complete');
      console.log('Setup completo!');
      
      // Refresh connection test
      window.location.reload();
    } catch (err) {
      console.error('Erro no setup:', err);
      setStep('check');
    }
  };

  const tablesReady = connectionData && connectionData.tables_created >= 3;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Setup do Banco Supabase
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Status da Conexão */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Status da Conexão</h3>
            {loading && <p className="text-blue-600">Verificando conexão...</p>}
            {error && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Erro de conexão: {error.message}</span>
              </div>
            )}
            {connectionData && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>✅ Conectado ao Supabase!</span>
                </div>
                <p><strong>Tabelas criadas:</strong> {connectionData.tables_created}/4</p>
                <p><strong>Colunas Kanban:</strong> {connectionData.kanban_columns_count}</p>
                <p><strong>Projetos:</strong> {connectionData.projetos_count}</p>
                <p><strong>Timestamp:</strong> {new Date(connectionData.timestamp).toLocaleString()}</p>
              </div>
            )}
          </div>

          {/* Botão de Setup */}
          {!tablesReady && !loading && !error && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                As tabelas principais não foram encontradas no Supabase. Execute o setup abaixo para criar a estrutura.
              </AlertDescription>
            </Alert>
          )}

          {!tablesReady && (
            <Button 
              onClick={handleSetupSupabase}
              disabled={applyLoading || insertLoading || loading}
              className="w-full"
              size="lg"
            >
              <Play className="mr-2 h-4 w-4" />
              {step === 'check' && 'Criar Estrutura no Supabase'}
              {step === 'creating' && 'Criando tabelas...'}
              {step === 'inserting' && 'Inserindo dados padrão...'}
              {step === 'complete' && '✅ Setup Completo!'}
            </Button>
          )}

          {/* Erros */}
          {(applyError || insertError) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Erro no setup: {applyError?.message || insertError?.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Sucesso */}
          {tablesReady && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                ✅ Supabase configurado com sucesso! Todas as tabelas estão prontas.
              </AlertDescription>
            </Alert>
          )}

        </CardContent>
      </Card>

      {/* Instruções Manuais */}
      <Card>
        <CardHeader>
          <CardTitle>Opção Manual (SQL Editor do Supabase)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>Se preferir criar manualmente:</p>
            <ol className="list-decimal list-inside space-y-1 pl-4">
              <li>Acesse o painel do Supabase</li>
              <li>Vá em <strong>SQL Editor</strong></li>
              <li>Execute o script SQL das tabelas principais</li>
              <li>Insira os dados padrão (colunas Kanban, etc.)</li>
            </ol>
            <p className="text-amber-600">
              ⚠️ <strong>Importante:</strong> O Supabase não suporta migrações automáticas do UI Bakery.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
