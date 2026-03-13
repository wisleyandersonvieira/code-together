import { useState } from 'react';
import { useMutateAction, useLoadAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Download, CheckCircle, AlertTriangle, Play } from 'lucide-react';
import testSupabaseConnection from '@/actions/testSupabaseConnection';
import runSupabaseMigration from '@/actions/runSupabaseMigration';
import applySupabaseStructure from '@/actions/applySupabaseStructure';
import insertSupabaseDefaults from '@/actions/insertSupabaseDefaults';
import migrateExistingDataAction from '@/actions/migrateExistingData';

type MigrationStep = {
  name: string;
  description: string;
  completed: boolean;
  error?: string;
  data?: any;
};

export function FullSupabaseMigration() {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<MigrationStep[]>([
    { name: 'Verificar Conexão', description: 'Testando conexão com Supabase...', completed: false },
    { name: 'Verificar Status', description: 'Checando estrutura existente...', completed: false },
    { name: 'Criar Estrutura', description: 'Criando tabelas principais...', completed: false },
    { name: 'Inserir Dados', description: 'Inserindo dados padrão...', completed: false },
    { name: 'Migrar Dados', description: 'Migrando dados existentes...', completed: false },
    { name: 'Verificar Resultado', description: 'Validando migração...', completed: false }
  ]);

  // Hooks para as ações
  const [connectionData, , connectionError] = useLoadAction(testSupabaseConnection, []);
  const [checkMigration, checkLoading, checkError] = useMutateAction(runSupabaseMigration);
  const [applyStructure, applyLoading, applyError] = useMutateAction(applySupabaseStructure);
  const [insertDefaults, insertLoading, insertError] = useMutateAction(insertSupabaseDefaults);
  const [migrateData, migrateLoading, migrateError] = useMutateAction(migrateExistingDataAction);
  const [validateResult, validateLoading, validateError] = useMutateAction(testSupabaseConnection);

  const updateStep = (stepIndex: number, updates: Partial<MigrationStep>) => {
    setSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, ...updates } : step
    ));
  };

  const executeFullMigration = async () => {
    setIsRunning(true);
    setProgress(0);
    setCurrentStep(0);

    try {
      // Passo 1: Verificar conexão
      console.log('🔗 Passo 1: Verificando conexão...');
      setCurrentStep(0);
      setProgress(10);
      
      if (connectionError) {
        throw new Error(`Erro de conexão: ${connectionError.message}`);
      }
      
      updateStep(0, { completed: true, data: connectionData });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Passo 2: Verificar status atual
      console.log('📊 Passo 2: Verificando status...');
      setCurrentStep(1);
      setProgress(25);
      
      const migrationStatus = await checkMigration({});
      updateStep(1, { completed: true, data: migrationStatus });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Passo 3: Criar estrutura
      console.log('🏗️ Passo 3: Criando estrutura...');
      setCurrentStep(2);
      setProgress(50);
      
      const structureResult = await applyStructure({});
      updateStep(2, { completed: true, data: structureResult });
      await new Promise(resolve => setTimeout(resolve, 800));

      // Passo 4: Inserir dados padrão
      console.log('📝 Passo 4: Inserindo dados padrão...');
      setCurrentStep(3);
      setProgress(60);
      
      const defaultsResult = await insertDefaults({});
      updateStep(3, { completed: true, data: defaultsResult });
      await new Promise(resolve => setTimeout(resolve, 800));

      // Passo 5: Migrar dados existentes
      console.log('🔄 Passo 5: Migrando dados existentes...');
      setCurrentStep(4);
      setProgress(80);
      
      const migrateResult = await migrateData({});
      updateStep(4, { completed: true, data: migrateResult });
      await new Promise(resolve => setTimeout(resolve, 800));

      // Passo 6: Verificar resultado final
      console.log('✅ Passo 6: Validando resultado...');
      setCurrentStep(5);
      setProgress(90);
      
      const finalResult = await validateResult({});
      updateStep(5, { completed: true, data: finalResult });

      setProgress(100);
      console.log('🎉 Migração completa com sucesso!');
      
    } catch (error: any) {
      console.error('❌ Erro na migração:', error);
      updateStep(currentStep, { 
        error: error.message || 'Erro desconhecido',
        completed: false 
      });
    } finally {
      setIsRunning(false);
    }
  };

  const isLoading = checkLoading || applyLoading || insertLoading || migrateLoading || validateLoading;
  const hasErrors = checkError || applyError || insertError || migrateError || validateError || connectionError;
  const allCompleted = steps.every(step => step.completed);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Database className="h-6 w-6 text-blue-600" />
            Migração Completa para Supabase
            {allCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Esta ferramenta criará TODA a estrutura do sistema no banco Supabase, incluindo:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li><strong>Tabelas principais:</strong> usuários, clientes, projetos, kanban</li>
              <li><strong>Sistema financeiro:</strong> contas a pagar/receber, produtos, grupos contábeis</li>
              <li><strong>Sistema de projetos:</strong> orçamentos, membros, tarefas, comentários</li>
              <li><strong>Estruturas DRE:</strong> matrizes, sócios, aportes, retiradas</li>
              <li><strong>Dados padrão:</strong> colunas kanban, parâmetros, tipos de documento</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {(isRunning || progress > 0) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Progresso da Migração</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full h-2" />
              
              {isRunning && (
                <p className="text-sm text-blue-600 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  {steps[currentStep]?.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps Status */}
      <Card>
        <CardHeader>
          <CardTitle>Passos da Migração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.completed ? 'bg-green-100 text-green-800' :
                    currentStep === index && isRunning ? 'bg-blue-100 text-blue-800' :
                    step.error ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {step.completed ? '✓' : step.error ? '✗' : index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{step.name}</h4>
                    <p className="text-sm text-gray-600">{step.description}</p>
                    {step.error && (
                      <p className="text-sm text-red-600">❌ {step.error}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  {step.completed && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {step.error && (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  {currentStep === index && isRunning && (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <Card>
        <CardContent className="pt-6">
          {!allCompleted && (
            <Button 
              onClick={executeFullMigration}
              disabled={isRunning || isLoading}
              className="w-full"
              size="lg"
            >
              <Play className="mr-2 h-4 w-4" />
              {isRunning ? 'Executando Migração...' : 'Iniciar Migração Completa'}
            </Button>
          )}
          
          {allCompleted && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                🎉 <strong>Migração concluída com sucesso!</strong> Todas as tabelas foram criadas no Supabase.
                Agora você pode alterar suas ações para usar o banco <code>provisonsupabase</code>.
              </AlertDescription>
            </Alert>
          )}
          
          {hasErrors && !isRunning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                ❌ <strong>Erros encontrados:</strong> Verifique os detalhes nos passos acima e tente novamente.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Após a Migração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>Depois que a migração for concluída:</p>
            <ol className="list-decimal list-inside space-y-1 pl-4">
              <li>Todas as ações principais já usam o banco correto</li>
              <li>Você pode criar novos dados diretamente no Supabase</li>
              <li>Use o painel do Supabase para monitorar os dados</li>
              <li>Configure backups e políticas de segurança no Supabase</li>
            </ol>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
