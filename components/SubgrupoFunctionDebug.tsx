'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import checkSubgruposFuncaoDataAction from '@/actions/checkSubgruposFuncaoData';

export function SubgrupoFunctionDebug() {
  const [subgrupos, loading, error] = useLoadAction(checkSubgruposFuncaoDataAction, []);

  if (loading) return <div>Carregando dados de função dos subgrupos...</div>;
  if (error) return <div>Erro: {error}</div>;

  console.log('=== DEBUGGING SUBGRUPO FUNCTIONS ===');
  console.log('Raw data from database:', subgrupos);
  
  const taxaAdm = subgrupos?.find((s: any) => s.descricao === 'Taxa Adm');
  console.log('Taxa Adm specifically:', taxaAdm);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debug - Funções dos Subgrupos Contábeis</CardTitle>
        <p className="text-sm text-muted-foreground">
          Verificando dados direto da tabela subgrupos_contabeis
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {subgrupos?.map((sub: any) => (
            <div key={sub.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="flex-1">
                <div className="font-medium">{sub.descricao}</div>
                <div className="text-sm text-muted-foreground">
                  Grupo: {sub.grupo_nome} (Tipo: {sub.grupo_tipo})
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={sub.funcao === 'CREDITO' ? 'default' : 'secondary'}>
                  {sub.funcao}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ID: {sub.id} | Grupo ID: {sub.grupo_id}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {taxaAdm && (
          <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
            <h4 className="font-semibold text-blue-800">Taxa Adm Específico:</h4>
            <pre className="text-sm mt-2 bg-white p-2 rounded border">
              {JSON.stringify(taxaAdm, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
