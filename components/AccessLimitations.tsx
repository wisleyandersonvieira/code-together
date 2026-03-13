'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Users, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AccessLimitations() {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Limitações de Acesso Público
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Erro detectado:</strong> User "Anonymous" denied access to Datasource
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Business Paid</h3>
              <Badge variant="default">Ativo</Badge>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Acesso público habilitado
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Usuários anônimos permitidos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Compartilhamento externo ativo
              </li>
            </ul>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Plano Pago</h3>
              <Badge variant="default">Recomendado</Badge>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Acesso público irrestrito
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Compartilhamento externo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Usuários anônimos permitidos
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Próximos Passos
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li><strong>Publicar aplicação</strong> - Use o botão "Publish" no UI Bakery</li>
            <li><strong>Obter URL pública</strong> - Copie a URL pública gerada</li>
            <li><strong>Testar acesso externo</strong> - Abra em navegador anônimo</li>
            <li><strong>Compartilhar com usuários</strong> - Distribua a URL pública</li>
          </ol>
        </div>

        <div className="text-center text-sm text-gray-600">
          <p>✅ Plano Business ativo - Acesso público liberado!</p>
        </div>
      </CardContent>
    </Card>
  );
}
