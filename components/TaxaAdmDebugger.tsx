'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import verifyTaxaAdmFunctionAction from '@/actions/verifyTaxaAdmFunction';

export function TaxaAdmDebugger() {
  const [taxaAdmData, loading, error] = useLoadAction(verifyTaxaAdmFunctionAction, []);

  console.log('=== TAXA ADM RAW DATABASE DATA ===');
  console.log('Loading:', loading);
  console.log('Error:', error);
  console.log('Raw data:', taxaAdmData);
  console.log('================================');

  if (loading) return <div>Carregando verificação Taxa Adm...</div>;
  if (error) return <div className="text-red-600">Erro: {String(error)}</div>;

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-blue-800">Taxa Adm - Verificação Direta do Banco</CardTitle>
        <p className="text-sm text-blue-600">Dados diretos da tabela subgrupos_contabeis</p>
      </CardHeader>
      <CardContent>
        {!taxaAdmData || taxaAdmData.length === 0 ? (
          <p className="text-yellow-600">Nenhum registro encontrado com "Taxa" ou "Adm" no nome</p>
        ) : (
          <div className="space-y-4">
            {taxaAdmData.map((item: any) => (
              <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold">{item.descricao}</h4>
                    <p className="text-sm text-gray-600">ID: {item.id} | Grupo ID: {item.grupo_id}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={item.funcao?.toUpperCase() === 'CREDITO' ? 'default' : 'secondary'}>
                      {item.funcao}
                    </Badge>
                  </div>
                </div>
                
                <div className="mt-3 text-xs space-y-1 font-mono bg-white p-2 rounded border">
                  <div>Função Raw: "{item.funcao}"</div>
                  <div>Função Trimmed: "{item.funcao_trimmed}"</div>
                  <div>Length: {item.funcao_length}</div>
                  <div>First Char ASCII: {item.funcao_ascii_first_char}</div>
                  <div>Equals 'CREDITO': {item.funcao === 'CREDITO' ? 'true' : 'false'}</div>
                  <div>Upper Equals 'CREDITO': {item.funcao?.toUpperCase() === 'CREDITO' ? 'true' : 'false'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
