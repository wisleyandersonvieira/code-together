'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import debugSomaReferencesAction from '@/actions/debugSomaReferences';

export function DebugSomaReferences() {
  const [estruturaId, setEstruturaId] = useState<string>('9');
  const [shouldLoad, setShouldLoad] = useState(false);

  const [referencias, loading] = useLoadAction(
    debugSomaReferencesAction,
    [],
    { estruturaId: estruturaId ? parseInt(estruturaId) : null },
    shouldLoad && !!estruturaId
  );

  const handleLoad = () => {
    if (estruturaId) {
      setShouldLoad(true);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Debug - Referências das Linhas SOMA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end mb-4">
            <div>
              <label className="text-sm font-medium">ID da Estrutura DRE</label>
              <Input
                value={estruturaId}
                onChange={(e) => setEstruturaId(e.target.value)}
                placeholder="ID da estrutura"
                type="number"
              />
            </div>
            <Button onClick={handleLoad} disabled={loading}>
              Verificar Referências
            </Button>
          </div>

          {loading && <div>Carregando...</div>}

          {referencias && referencias.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SOMA ID</TableHead>
                    <TableHead>Nome da SOMA</TableHead>
                    <TableHead>Referência ID</TableHead>
                    <TableHead>Nome Referenciado</TableHead>
                    <TableHead>Tipo Referenciado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referencias.map((ref: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{ref.soma_item_id}</TableCell>
                      <TableCell>{ref.soma_nome}</TableCell>
                      <TableCell>
                        {ref.referenced_item_id || (
                          <Badge variant="destructive">SEM REFERÊNCIA</Badge>
                        )}
                      </TableCell>
                      <TableCell>{ref.referenced_nome || '-'}</TableCell>
                      <TableCell>
                        {ref.referenced_tipo && (
                          <Badge variant="secondary">{ref.referenced_tipo}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : shouldLoad && !loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Nenhuma linha SOMA encontrada ou nenhuma referência configurada.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
