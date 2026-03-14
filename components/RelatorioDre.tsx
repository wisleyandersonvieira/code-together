'use client';

import React, { useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import { DreDataLoader } from '@/components/DreDataLoader';
import {
  ListingFilterCard,
  ListingPageHeader,
  ListingTableCard,
  listingPrimaryButtonClassName,
  listingSecondaryButtonClassName,
} from '@/components/finance/listing-ui';


interface DreParams {
  estruturaId: number;
  matrizId: number;
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
}



export function RelatorioDre() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [params, setParams] = useState<DreParams>({
    estruturaId: 0,
    matrizId: 0,
    tipoData: 'competencia',
    dataInicio: '',
    dataFim: '',
  });
  const [showReport, setShowReport] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load data for selects
  const [estruturas] = useLoadAction(loadEstruturasDreAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });
  


  const handleParamChange = (field: keyof DreParams, value: any) => {
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
      <ListingPageHeader
        title="Relatório DRE"
        description="Configure e gere o demonstrativo de resultado em um layout alinhado ao padrão premium do sistema."
      />

      <ListingFilterCard>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 text-sm font-semibold text-slate-700">Parâmetros do Relatório</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Estrutura DRE *</label>
                <Select
                  value={params.estruturaId.toString()}
                  onValueChange={(value) => handleParamChange('estruturaId', parseInt(value))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
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
                <label className="text-sm font-medium text-slate-700">Matriz *</label>
                <Select
                  value={params.matrizId.toString()}
                  onValueChange={(value) => handleParamChange('matrizId', parseInt(value))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
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
                <label className="text-sm font-medium text-slate-700">Emitir por *</label>
                <Select
                  value={params.tipoData}
                  onValueChange={(value) => handleParamChange('tipoData', value)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="competencia">Data de Competência</SelectItem>
                    <SelectItem value="pagamento">Data de Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Início *</label>
                <Input
                  type="date"
                  value={params.dataInicio}
                  onChange={(e) => handleParamChange('dataInicio', e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Data Fim *</label>
                <Input
                  type="date"
                  value={params.dataFim}
                  onChange={(e) => handleParamChange('dataFim', e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className={listingPrimaryButtonClassName} onClick={generateDre}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar DRE
            </Button>
            {showReport && (
              <Button className={listingSecondaryButtonClassName} onClick={() => setShowReport(false)}>
                Ocultar Relatório
              </Button>
            )}
          </div>
        </div>
      </ListingFilterCard>

      {showReport && (
        <ListingTableCard>
          <CardHeader className="border-b border-slate-200/80 bg-slate-50/70">
            <CardTitle className="text-lg text-slate-900">Demonstrativo de Resultado do Exercício</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <DreDataLoader
              estruturaId={params.estruturaId}
              matrizId={params.matrizId}
              tipoData={params.tipoData}
              dataInicio={params.dataInicio}
              dataFim={params.dataFim}
              refreshTrigger={refreshTrigger}
              onComplete={() => {
                toast({
                  title: 'Sucesso',
                  description: 'Relatório DRE gerado com sucesso.',
                });
              }}
            />
          </CardContent>
        </ListingTableCard>
      )}
    </div>
  );
}
