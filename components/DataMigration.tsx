import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMutateAction } from '@uibakery/data';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import migrateExistingDataAction from '@/actions/migrateExistingData';

export function DataMigration() {
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrateData, isMigrating, error] = useMutateAction(migrateExistingDataAction);

  const handleMigrate = async () => {
    try {
      const result = await migrateData({});
      setMigrationResult(result);
    } catch (err) {
      console.error('Erro na migração:', err);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          Migração de Dados - Supabase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Esta ação irá migrar os dados existentes das tabelas básicas para a nova estrutura completa:</p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>Migrar usuários de app_users para users</li>
            <li>Configurar colunas kanban padrão</li>
            <li>Atualizar projetos com colunas kanban</li>
            <li>Inserir parâmetros do sistema</li>
          </ul>
        </div>

        {!migrationResult && (
          <Button 
            onClick={handleMigrate} 
            disabled={isMigrating}
            className="w-full"
          >
            {isMigrating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrando Dados...
              </>
            ) : (
              'Executar Migração de Dados'
            )}
          </Button>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm font-medium">Erro na migração:</p>
            <p className="text-red-600 text-sm">{error.message}</p>
          </div>
        )}

        {migrationResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Migração Concluída!</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-medium">Usuários:</span> {migrationResult[0]?.users_count || 0}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-medium">Clientes:</span> {migrationResult[0]?.clientes_count || 0}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-medium">Projetos:</span> {migrationResult[0]?.projetos_count || 0}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-medium">Colunas Kanban:</span> {migrationResult[0]?.kanban_columns_count || 0}
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-medium">Parâmetros:</span> {migrationResult[0]?.parametros_count || 0}
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 text-sm">
                ✅ Todos os dados foram migrados com sucesso! Agora você pode usar o sistema completo.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
