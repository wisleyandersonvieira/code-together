import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import testSupabaseConnection from '@/actions/testSupabaseConnection';
import applySupabaseStructure from '@/actions/applySupabaseStructure';
import insertSupabaseDefaults from '@/actions/insertSupabaseDefaults';

export function SupabaseConnectionTest() {
  const [connectionData, connectionLoading, connectionError] = useLoadAction(testSupabaseConnection, []);
  const [applyStructure, applyLoading] = useMutateAction(applySupabaseStructure);
  const [insertDefaults, insertLoading] = useMutateAction(insertSupabaseDefaults);
  
  const handleApplyStructure = async () => {
    try {
      await applyStructure({});
      console.log('Estrutura aplicada com sucesso!');
    } catch (error) {
      console.error('Erro ao aplicar estrutura:', error);
    }
  };
  
  const handleInsertDefaults = async () => {
    try {
      await insertDefaults({});
      console.log('Dados padrão inseridos com sucesso!');
    } catch (error) {
      console.error('Erro ao inserir dados padrão:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Teste de Conectividade com Supabase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="font-semibold">Status da Conexão:</h3>
          {connectionLoading && <p>Testando conexão...</p>}
          {connectionError && (
            <p className="text-red-500">Erro: {connectionError.message}</p>
          )}
          {connectionData && (
            <div className="bg-gray-50 p-3 rounded">
              <p><strong>Status:</strong> {connectionData.status}</p>
              <p><strong>Timestamp:</strong> {new Date(connectionData.timestamp).toLocaleString()}</p>
              <p><strong>Tabelas criadas:</strong> {connectionData.tables_created}</p>
              <p><strong>Colunas Kanban:</strong> {connectionData.kanban_columns_count}</p>
              <p><strong>Projetos:</strong> {connectionData.projetos_count}</p>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold">Ações de Migração:</h3>
          <div className="flex gap-2">
            <Button 
              onClick={handleApplyStructure} 
              disabled={applyLoading}
              variant="outline"
            >
              {applyLoading ? 'Aplicando...' : 'Aplicar Estrutura'}
            </Button>
            <Button 
              onClick={handleInsertDefaults} 
              disabled={insertLoading}
              variant="outline"
            >
              {insertLoading ? 'Inserindo...' : 'Inserir Dados Padrão'}
            </Button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <h4 className="font-semibold mb-2">Como usar o Supabase:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Execute "Aplicar Estrutura" para criar as tabelas</li>
            <li>Execute "Inserir Dados Padrão" para adicionar dados iniciais</li>
            <li>Todas as ações já estão configuradas para usar o Supabase</li>
            <li>Use os componentes normalmente - eles agora conectam ao Supabase</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
