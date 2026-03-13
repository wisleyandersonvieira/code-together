'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import debugTaxaAdmAction from '@/actions/debugTaxaAdm';
import loadAllSubgruposContabeisAction from '@/actions/loadAllSubgruposContabeis';

export function DebugTaxaAdm() {
  const [taxaAdmData, loading1, error1] = useLoadAction(debugTaxaAdmAction, []);
  const [allSubgrupos, loading2, error2] = useLoadAction(loadAllSubgruposContabeisAction, []);

  console.log('Taxa Adm specific data:', taxaAdmData);
  console.log('All subgrupos data:', allSubgrupos);

  if (loading1 || loading2) return <div>Carregando...</div>;
  if (error1 || error2) return <div>Erro: {error1 || error2}</div>;

  const taxaAdmFromAll = allSubgrupos?.find((sub: any) => sub.descricao === 'Taxa Adm');
  console.log('Taxa Adm from all subgrupos:', taxaAdmFromAll);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Debug - Taxa Adm Específico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {taxaAdmData?.map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                <span className="font-medium">{item.descricao}</span>
                <Badge variant={item.funcao === 'CREDITO' ? 'default' : 'secondary'}>
                  {item.funcao}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Grupo: {item.grupo_nome} (ID: {item.grupo_id})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debug - Taxa Adm de Todos Subgrupos</CardTitle>
        </CardHeader>
        <CardContent>
          {taxaAdmFromAll ? (
            <div className="flex items-center gap-2 p-2 border rounded">
              <span className="font-medium">{taxaAdmFromAll.descricao}</span>
              <Badge variant={taxaAdmFromAll.funcao === 'CREDITO' ? 'default' : 'secondary'}>
                {taxaAdmFromAll.funcao}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Grupo: {taxaAdmFromAll.grupo_nome} (ID: {taxaAdmFromAll.grupo_id})
              </span>
            </div>
          ) : (
            <p>Taxa Adm não encontrado na consulta de todos subgrupos</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
