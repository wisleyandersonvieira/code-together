'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import loadEstruturaDreItensWithDebugAction from '@/actions/loadEstruturaDreItensWithDebug';

interface TestSomaQueryProps {
  estruturaId: number;
}

export function TestSomaQuery({ estruturaId }: TestSomaQueryProps) {
  const [results, loading, error] = useLoadAction(
    loadEstruturaDreItensWithDebugAction,
    [],
    { estruturaId }
  );

  if (loading) return <div>Testando query...</div>;
  if (error) return <div>Erro na query: {error.message}</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test SOMA Query Results</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-96">
          {JSON.stringify(results, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
