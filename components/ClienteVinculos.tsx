'use client';

import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building, Users, FolderOpen } from 'lucide-react';
import loadClienteVinculosAction from '@/actions/loadClienteVinculos';

interface Vinculo {
  tipo: string;
  nome: string;
  entity_id: number;
  percentage?: number;
  vinculo_tipo: string;
}

interface ClienteVinculosProps {
  clienteId: number;
}

export function ClienteVinculos({ clienteId }: ClienteVinculosProps) {
  const [vinculos, loading, error] = useLoadAction(loadClienteVinculosAction, [], { clienteId });

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'empresa':
        return <Building className="h-4 w-4" />;
      case 'grupo':
        return <Users className="h-4 w-4" />;
      case 'projeto':
        return <FolderOpen className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'empresa':
        return 'bg-blue-100 text-blue-800';
      case 'grupo':
        return 'bg-green-100 text-green-800';
      case 'projeto':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVinculoColor = (vinculoTipo: string) => {
    switch (vinculoTipo) {
      case 'direto':
        return 'bg-emerald-100 text-emerald-800';
      case 'via empresa':
        return 'bg-blue-100 text-blue-800';
      case 'via grupo':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando vínculos...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">Erro ao carregar vínculos</div>
        </CardContent>
      </Card>
    );
  }

  if (!vinculos || vinculos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vínculos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Este cliente não possui vínculos com empresas, grupos ou projetos.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vínculos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Percentual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vinculos.map((vinculo: Vinculo, index: number) => (
                <TableRow key={`${vinculo.tipo}-${vinculo.entity_id}-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getIcon(vinculo.tipo)}
                      <Badge className={getTypeColor(vinculo.tipo)}>
                        {vinculo.tipo.charAt(0).toUpperCase() + vinculo.tipo.slice(1)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{vinculo.nome}</TableCell>
                  <TableCell>
                    <Badge className={getVinculoColor(vinculo.vinculo_tipo)}>
                      {vinculo.vinculo_tipo.charAt(0).toUpperCase() + vinculo.vinculo_tipo.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {vinculo.percentage ? `${vinculo.percentage}%` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
