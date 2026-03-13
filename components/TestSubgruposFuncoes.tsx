'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import debugSubgruposFuncoesAction from '@/actions/debugSubgruposFuncoes';

export function TestSubgruposFuncoes() {
  const [subgrupos, loading, error] = useLoadAction(debugSubgruposFuncoesAction, []);

  console.log('Subgrupos data:', subgrupos);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {String(error)}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug - Subgrupos e Funções</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {subgrupos?.map((sub: any) => (
            <div key={sub.id} className="flex items-center gap-2 p-2 border rounded">
              <span className="font-medium">{sub.descricao}</span>
              <Badge variant={sub.funcao === 'CREDITO' ? 'default' : 'secondary'}>
                {sub.funcao}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Grupo: {sub.grupo_nome}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
