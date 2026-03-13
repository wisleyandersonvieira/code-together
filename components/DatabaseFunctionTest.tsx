'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import verifyTaxaAdmFunctionAction from '@/actions/verifyTaxaAdmFunction';
import debugDreStructureLoadingAction from '@/actions/debugDreStructureLoading';
import loadAllSubgruposContabeisAction from '@/actions/loadAllSubgruposContabeis';

export function DatabaseFunctionTest() {
  const [taxaAdmDirect] = useLoadAction(verifyTaxaAdmFunctionAction, []);
  const [dreStructure] = useLoadAction(debugDreStructureLoadingAction, []);
  const [allSubgrupos] = useLoadAction(loadAllSubgruposContabeisAction, []);

  // Find Taxa Adm in all subgrupos
  const taxaAdmFromAll = allSubgrupos?.find((s: any) => 
    s.descricao?.toLowerCase().includes('taxa') || s.descricao?.toLowerCase().includes('adm')
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Verificação Direta - Taxa Adm</CardTitle>
        </CardHeader>
        <CardContent>
          {taxaAdmDirect?.length > 0 ? (
            taxaAdmDirect.map((item: any) => (
              <div key={item.id} className="p-3 border rounded space-y-2">
                <h4 className="font-semibold">{item.descricao}</h4>
                <Badge variant={item.funcao?.toUpperCase().trim() === 'CREDITO' ? 'default' : 'secondary'}>
                  {item.funcao}
                </Badge>
                <pre className="text-xs bg-gray-100 p-2 rounded">
{JSON.stringify(item, null, 2)}
                </pre>
              </div>
            ))
          ) : (
            <p>Nenhum Taxa Adm encontrado na consulta direta</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Taxa Adm em loadAllSubgruposContabeis</CardTitle>
        </CardHeader>
        <CardContent>
          {taxaAdmFromAll ? (
            <div className="p-3 border rounded space-y-2">
              <h4 className="font-semibold">{taxaAdmFromAll.descricao}</h4>
              <Badge variant={taxaAdmFromAll.funcao?.toUpperCase().trim() === 'CREDITO' ? 'default' : 'secondary'}>
                {taxaAdmFromAll.funcao}
              </Badge>
              <pre className="text-xs bg-gray-100 p-2 rounded">
{JSON.stringify(taxaAdmFromAll, null, 2)}
              </pre>
            </div>
          ) : (
            <p>Taxa Adm não encontrado em loadAllSubgruposContabeis</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. DRE Structure Debug</CardTitle>
        </CardHeader>
        <CardContent>
          {dreStructure?.length > 0 ? (
            dreStructure.map((item: any) => (
              <div key={item.id} className="p-3 border rounded space-y-2">
                <h4 className="font-semibold">{item.nome}</h4>
                <p className="text-sm">Subgrupo: {item.subgrupo_descricao}</p>
                <Badge variant={item.subgrupo_funcao_raw?.toUpperCase().trim() === 'CREDITO' ? 'default' : 'secondary'}>
                  {item.subgrupo_funcao_raw}
                </Badge>
                <pre className="text-xs bg-gray-100 p-2 rounded">
{JSON.stringify(item, null, 2)}
                </pre>
              </div>
            ))
          ) : (
            <p>Nenhuma estrutura DRE com Taxa encontrada</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
