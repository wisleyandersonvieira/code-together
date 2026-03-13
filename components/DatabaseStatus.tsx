import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, CheckCircle, XCircle } from 'lucide-react';
import loadProjetos from '@/actions/loadProjetos';
import loadKanbanColumns from '@/actions/loadKanbanColumns';
import loadClientes from '@/actions/loadClientes';

export function DatabaseStatus() {
  const [projetos, projetosLoading, projetosError] = useLoadAction(loadProjetos, []);
  const [columns, columnsLoading, columnsError] = useLoadAction(loadKanbanColumns, []);
  const [clientes, clientesLoading, clientesError] = useLoadAction(loadClientes, []);

  const tests = [
    { name: 'Projetos', loading: projetosLoading, error: projetosError, data: projetos },
    { name: 'Kanban Columns', loading: columnsLoading, error: columnsError, data: columns },
    { name: 'Clientes', loading: clientesLoading, error: clientesError, data: clientes }
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Status do Banco de Dados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tests.map((test, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="font-medium">{test.name}</span>
              <div className="flex items-center gap-2">
                {test.loading && <Badge variant="secondary">Carregando...</Badge>}
                {test.error && (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <Badge variant="destructive">Erro</Badge>
                  </>
                )}
                {!test.loading && !test.error && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Badge variant="default" className="bg-green-500">
                      Conectado ({Array.isArray(test.data) ? test.data.length : 'OK'})
                    </Badge>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {tests.some(t => t.error) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <h4 className="font-semibold text-red-800 mb-2">Erros Encontrados:</h4>
            {tests.filter(t => t.error).map((test, index) => (
              <div key={index} className="text-sm text-red-600">
                <strong>{test.name}:</strong> {test.error?.message}
              </div>
            ))}
          </div>
        )}
        
        {tests.every(t => !t.loading && !t.error) && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-semibold">✅ Todas as conexões estão funcionando!</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
