'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ExternalLink, Share2, Globe, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PublicationGuide() {
  const steps = [
    {
      icon: Settings,
      title: "1. Configurar Aplicação",
      description: "Certifique-se de que todas as funcionalidades estão funcionando",
      status: "completed"
    },
    {
      icon: Globe,
      title: "2. Publicar no UI Bakery",
      description: "Use o botão 'Publish' no dashboard do UI Bakery",
      status: "pending"
    },
    {
      icon: ExternalLink,
      title: "3. Obter URL Pública",
      description: "Copie a URL pública gerada após a publicação",
      status: "pending"
    },
    {
      icon: Share2,
      title: "4. Testar Acesso Externo",
      description: "Abra a URL em modo anônimo/incógnito",
      status: "pending"
    }
  ];

  const handleOpenUIBakery = () => {
    window.open('https://app.uibakery.io/', '_blank');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Guia de Publicação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-sm font-medium text-blue-800">
            ✅ Plano Business ativo - Você pode publicar sua aplicação para acesso público!
          </p>
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
              <div className={`p-2 rounded-full ${step.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                <step.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  {step.status === 'completed' && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <Button onClick={handleOpenUIBakery} className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir UI Bakery Dashboard
          </Button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Vá para o dashboard e clique em "Publish" no seu projeto
          </p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-yellow-800">⚠️ Importante</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• A URL pública será diferente da URL de desenvolvimento</li>
            <li>• Teste sempre em modo anônimo antes de compartilhar</li>
            <li>• Usuários externos não precisarão de login no UI Bakery</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
