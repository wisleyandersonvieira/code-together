'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import loadAllSubgruposContabeisAction from '@/actions/loadAllSubgruposContabeis';
import checkSubgruposFuncaoDataAction from '@/actions/checkSubgruposFuncaoData';

export function DebugDreStructure() {
  const [allSubgrupos] = useLoadAction(loadAllSubgruposContabeisAction, []);
  const [directSubgrupos] = useLoadAction(checkSubgruposFuncaoDataAction, []);

  const taxaAdmFromAll = allSubgrupos?.find((s: any) => s.descricao === 'Taxa Adm');
  const taxaAdmFromDirect = directSubgrupos?.find((s: any) => s.descricao === 'Taxa Adm');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Debug - Taxa Adm Function Issue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">From loadAllSubgruposContabeis:</h4>
              {taxaAdmFromAll ? (
                <div className="p-3 border rounded">
                  <div className="font-medium">{taxaAdmFromAll.descricao}</div>
                  <Badge variant={taxaAdmFromAll.funcao === 'CREDITO' ? 'default' : 'secondary'}>
                    {taxaAdmFromAll.funcao}
                  </Badge>
                  <pre className="text-xs mt-2 bg-gray-50 p-2 rounded">
                    {JSON.stringify(taxaAdmFromAll, null, 2)}
                  </pre>
                </div>
              ) : (
                <p>Taxa Adm não encontrado</p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">From checkSubgruposFuncaoData:</h4>
              {taxaAdmFromDirect ? (
                <div className="p-3 border rounded">
                  <div className="font-medium">{taxaAdmFromDirect.descricao}</div>
                  <Badge variant={taxaAdmFromDirect.funcao === 'CREDITO' ? 'default' : 'secondary'}>
                    {taxaAdmFromDirect.funcao}
                  </Badge>
                  <pre className="text-xs mt-2 bg-gray-50 p-2 rounded">
                    {JSON.stringify(taxaAdmFromDirect, null, 2)}
                  </pre>
                </div>
              ) : (
                <p>Taxa Adm não encontrado</p>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <h4 className="font-medium text-yellow-800">Comparação:</h4>
            <ul className="text-sm text-yellow-700 mt-1 space-y-1">
              <li>Funções iguais: {taxaAdmFromAll?.funcao === taxaAdmFromDirect?.funcao ? 'SIM' : 'NÃO'}</li>
              <li>Função All: "{taxaAdmFromAll?.funcao}"</li>
              <li>Função Direct: "{taxaAdmFromDirect?.funcao}"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
