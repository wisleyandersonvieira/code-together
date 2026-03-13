'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadProjetosAction from '@/actions/loadProjetos';
import { DreProjetoDataLoader } from '@/components/DreProjetoDataLoader';

interface DreProjetoParams {
  estruturaId: number;
  matrizId: number;
  statusProjeto: 'Em andamento' | 'Concluído' | 'Ambos';
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
}

export function RelatorioDreProjeto() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [params, setParams] = useState<DreProjetoParams>({
    estruturaId: 0,
    matrizId: 0,
    statusProjeto: 'Ambos',
    tipoData: 'competencia',
    dataInicio: '',
    dataFim: '',
  });
  const [showReport, setShowReport] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load data for selects
  const [estruturas] = useLoadAction(loadEstruturasDreAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });

  const handleParamChange = (field: keyof DreProjetoParams, value: any) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const generateDre = () => {
    if (!params.estruturaId || !params.matrizId || !params.dataInicio || !params.dataFim) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setShowReport(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <FileText className="mr-3 h-6 w-6" />
            Relatório DRE Projeto
          </h2>
          <p className="text-muted-foreground">
            Demonstrativo de Resultado do Exercício por Projeto
          </p>
        </div>
      </div>

      {/* Parameters Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Estrutura DRE *</label>
              <Select
                value={params.estruturaId.toString()}
                onValueChange={(value) => handleParamChange('estruturaId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a estrutura" />
                </SelectTrigger>
                <SelectContent>
                  {estruturas?.map((estrutura: any) => (
                    <SelectItem key={estrutura.id} value={estrutura.id.toString()}>
                      {estrutura.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Matriz *</label>
              <Select
                value={params.matrizId.toString()}
                onValueChange={(value) => handleParamChange('matrizId', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a matriz" />
                </SelectTrigger>
                <SelectContent>
                  {matrizes?.map((matriz: any) => (
                    <SelectItem key={matriz.id} value={matriz.id.toString()}>
                      {matriz.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status do Projeto *</label>
              <Select
                value={params.statusProjeto}
                onValueChange={(value) => handleParamChange('statusProjeto', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Emitir por *</label>
              <Select
                value={params.tipoData}
                onValueChange={(value) => handleParamChange('tipoData', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competencia">Data de Competência</SelectItem>
                  <SelectItem value="pagamento">Data de Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início *</label>
              <Input
                type="date"
                value={params.dataInicio}
                onChange={(e) => handleParamChange('dataInicio', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim *</label>
              <Input
                type="date"
                value={params.dataFim}
                onChange={(e) => handleParamChange('dataFim', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={generateDre}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar DRE
            </Button>
            {showReport && (
              <Button variant="outline" onClick={() => setShowReport(false)}>
                Ocultar Relatório
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DRE Report */}
      {showReport && (
        <Card>
          <CardHeader>
            <CardTitle>
              Demonstrativo de Resultado do Exercício - Status: {params.statusProjeto}
              <Badge variant={params.statusProjeto === 'Concluído' ? 'default' : params.statusProjeto === 'Em andamento' ? 'secondary' : 'outline'} className="ml-2">
                {params.statusProjeto}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DreProjetoDataLoader
              estruturaId={params.estruturaId}
              matrizId={params.matrizId}
              statusProjeto={params.statusProjeto}
              tipoData={params.tipoData}
              dataInicio={params.dataInicio}
              dataFim={params.dataFim}
              refreshTrigger={refreshTrigger}
              onComplete={() => {
                toast({
                  title: 'Sucesso',
                  description: 'Relatório DRE por Status de Projeto gerado com sucesso.',
                });
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
