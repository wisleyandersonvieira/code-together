'use client';

import React, { useEffect, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { usePdfExport } from '@/hooks/use-pdf-export';
import { useToast } from '@/hooks/use-toast';
import loadEstruturaDreItensAction from '@/actions/loadEstruturaDreItens';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import loadDreProjetoContasPagarAction from '@/actions/loadDreProjetoContasPagar';
import loadDreProjetoContasReceberAction from '@/actions/loadDreProjetoContasReceber';
import loadDreProjetoAportesAction from '@/actions/loadDreProjetoAportes';
import loadAportesAction from '@/actions/loadAportes';
import loadRetiradasAction from '@/actions/loadRetiradas';

interface DreProjetoDataLoaderProps {
  estruturaId: number;
  matrizId: number;
  statusProjeto: 'Em andamento' | 'Concluído' | 'Ambos';
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
  onComplete: () => void;
  refreshTrigger?: number;
}

interface DreItemResult {
  id: number;
  tipo: string;
  nome: string;
  ordem: number;
  nivel: number;
  grupo_contabil_id?: number;
  subgrupo_contabil_id?: number;
  subgrupo_funcao?: string;
  valor: number;
  parent_id?: number;
}

export function DreProjetoDataLoader({ 
  estruturaId, 
  matrizId, 
  statusProjeto, 
  tipoData, 
  dataInicio, 
  dataFim, 
  onComplete, 
  refreshTrigger 
}: DreProjetoDataLoaderProps) {
  const { formatCurrency } = useCurrency();
  const { exportDreToPdf } = usePdfExport();
  const { toast } = useToast();
  const [dreData, setDreData] = useState<DreItemResult[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Load structure items
  const [estruturaItens, loadingItens, , refreshEstrutura] = useLoadAction(
    loadEstruturaDreItensAction,
    [],
    { estruturaId }
  );

  // Load project-specific financial data by status
  const [contasPagar, loadingContasPagar] = useLoadAction(
    loadDreProjetoContasPagarAction,
    [],
    { matrizId, statusProjeto, tipoData, dataInicio, dataFim, estruturaId }
  );

  const [contasReceber, loadingContasReceber] = useLoadAction(
    loadDreProjetoContasReceberAction,
    [],
    { matrizId, statusProjeto, tipoData, dataInicio, dataFim, estruturaId }
  );

  const [aportes, loadingAportes] = useLoadAction(
    loadDreProjetoAportesAction,
    [],
    { matrizId, statusProjeto, dataInicio, dataFim }
  );

  // Load detailed aportes/retiradas for PDF export
  const [aportesDetalhados, loadingAportesDetalhados] = useLoadAction(
    loadAportesAction,
    [],
    { matrizId, dataInicio, dataFim }
  );

  const [retiradasDetalhadas, loadingRetiradasDetalhadas] = useLoadAction(
    loadRetiradasAction,
    [],
    { matrizId, dataInicio, dataFim }
  );

  // Load additional data for PDF export
  const [estruturas] = useLoadAction(
    loadEstruturasDreAction,
    []
  );
  
  const [matrizes] = useLoadAction(
    loadMatrizesAction,
    [],
    { searchNome: null }
  );

  const isLoading = loadingItens || loadingContasPagar || loadingContasReceber || loadingAportes || loadingAportesDetalhados || loadingRetiradasDetalhadas;

  // Reset calculation when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      setHasCalculated(false);
      refreshEstrutura();
    }
  }, [refreshTrigger, refreshEstrutura]);

  useEffect(() => {
    if (!isLoading && estruturaItens && contasPagar && contasReceber && aportes && !hasCalculated) {
      
      // Process and calculate values for each structure item
      const processedItems: DreItemResult[] = estruturaItens.map((item: any) => {
        let valor = 0;

        if (item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
          // Calculate value from contas pagar/receber related to the project
          // Use Number() to handle PostgreSQL NUMERIC types returned as strings
          const contasPagarValues = contasPagar
            .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
            .reduce((sum: number, cp: any) => sum + (Number(cp.valor_rateio) || 0), 0);

          const contasReceberValues = contasReceber
            .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
            .reduce((sum: number, cr: any) => sum + (Number(cr.valor_rateio) || 0), 0);

          valor = contasPagarValues + contasReceberValues;

          // Apply sign based on function from structure
          if (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO') {
            valor = -valor;
          }
        } else if (item.tipo === 'APORTE') {
          // Sum project-related aportes (positive)
          valor = aportes.reduce((sum: number, aporte: any) => sum + (Number(aporte.valor_rateado) || 0), 0);
        } else if (item.tipo === 'EMPRESTIMO_ENTRADA' || item.tipo === 'EMPRESTIMO_SAIDA') {
          // Empréstimos não possuem vínculo com projeto (não há rateio por projeto),
          // portanto não compõem o DRE por Projeto: valor permanece 0.
          valor = 0;
        } else if (item.tipo === 'GRUPO') {
          // Group value is sum of its subgroups
          const subgroupValues = estruturaItens
            .filter((subitem: any) => subitem.tipo === 'SUBGRUPO' && subitem.parent_id === item.id)
            .reduce((sum: number, subitem: any) => {
              // Calculate subgroup value (same logic as above)
              let subgroupValue = 0;
              if (subitem.subgrupo_contabil_id) {
                const contasPagarValues = contasPagar
                  .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(subitem.subgrupo_contabil_id))
                  .reduce((sum: number, cp: any) => sum + (Number(cp.valor_rateio) || 0), 0);

                const contasReceberValues = contasReceber
                  .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(subitem.subgrupo_contabil_id))
                  .reduce((sum: number, cr: any) => sum + (Number(cr.valor_rateio) || 0), 0);

                subgroupValue = contasPagarValues + contasReceberValues;

                // Get subgroup function from structure
                if (subitem.subgrupo_funcao === 'Débito' || subitem.subgrupo_funcao === 'DEBITO') {
                  subgroupValue = -subgroupValue;
                }
              }
              return sum + subgroupValue;
            }, 0);
          valor = subgroupValues;
        }

        return {
          id: item.id,
          tipo: item.tipo,
          nome: item.nome,
          ordem: item.ordem,
          nivel: item.nivel,
          grupo_contabil_id: item.grupo_contabil_id,
          subgrupo_contabil_id: item.subgrupo_contabil_id,
          subgrupo_funcao: item.subgrupo_funcao,
          parent_id: item.parent_id,
          valor,
        };
      });

      // Sort items by order to process SOMA lines correctly
      const sortedItems = processedItems.sort((a, b) => a.ordem - b.ordem);

      // Calculate SOMA items: sum all items with lower order numbers
      const finalItems = sortedItems.map((item, index) => {
        if (item.tipo === 'SOMA') {
          
          // Sum only SUBGRUPOS and APORTES above this SOMA line (exclude GRUPOS to avoid duplication)
          const itemsAbove = sortedItems.slice(0, index).filter(aboveItem => 
            aboveItem.tipo === 'SUBGRUPO' || 
            aboveItem.tipo === 'APORTE'
          );
          
          const somaValue = itemsAbove.reduce((sum: number, aboveItem) => {
            return sum + aboveItem.valor;
          }, 0);
          
          return { ...item, valor: somaValue };
        }
        return item;
      });

      setDreData(finalItems.sort((a, b) => a.ordem - b.ordem));
      setHasCalculated(true);
      onComplete();
    }
  }, [isLoading, estruturaItens, contasPagar, contasReceber, aportes, hasCalculated, onComplete]);

  const getItemTypeBadge = (tipo: string) => {
    const variants = {
      GRUPO: 'default',
      SUBGRUPO: 'secondary',
      SOMA: 'outline',
      APORTE: 'default',
      RETIRADA: 'destructive',
      EMPRESTIMO_ENTRADA: 'default',
      EMPRESTIMO_SAIDA: 'destructive',
    } as const;

    return (
      <Badge variant={variants[tipo as keyof typeof variants] || 'default'}>
        {tipo}
      </Badge>
    );
  };

  const getRowStyle = (item: DreItemResult) => {
    if (item.tipo === 'GRUPO' || item.tipo === 'SOMA') {
      return 'font-bold';
    }
    return '';
  };

  const getValueStyle = (item: DreItemResult) => {
    const baseStyle = `text-right ${getRowStyle(item)}`;
    
    // Para SUBGRUPOS com função DÉBITO, exibir em vermelho (valores já negativos)
    if (item.tipo === 'SUBGRUPO' && (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO')) {
      return `${baseStyle} text-red-600`;
    }
    
    // Para GRUPOS que contêm apenas DÉBITOS, também exibir em vermelho
    if (item.tipo === 'GRUPO' && item.valor < 0) {
      return `${baseStyle} text-red-600`;
    }
    
    // Para valores negativos em geral (inclui SOMA que pode ser negativa)
    if (item.valor < 0) {
      return `${baseStyle} text-red-600`;
    }
    
    // Para valores positivos
    return `${baseStyle} text-green-600`;
  };

  const handleExportPdf = () => {
    if (!dreData || dreData.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    const estruturaNome = estruturas?.find((e: any) => e.id === estruturaId)?.nome || 'N/A';
    const matrizNome = matrizes?.find((m: any) => m.id === matrizId)?.nome || 'N/A';

    const success = exportDreToPdf(
      dreData,
      `DRE por Projeto - Status: ${statusProjeto}`,
      {
        dataInicio,
        dataFim,
        tipoData,
        estruturaNome,
        matrizNome,
        statusProjeto,
      },
      {
        aportes: aportesDetalhados,
        retiradas: retiradasDetalhadas,
      }
    );

    if (success) {
      toast({
        title: 'Sucesso',
        description: 'Relatório DRE por Projeto exportado com sucesso!',
      });
    } else {
      toast({
        title: 'Erro',
        description: 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Carregando dados do DRE do Projeto...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Período: {dataInicio} a {dataFim} | 
          Critério: {tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dreData.map((item) => (
              <TableRow key={item.id} className={getRowStyle(item)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.ordem}
                    {getItemTypeBadge(item.tipo)}
                  </div>
                </TableCell>
                <TableCell className={getRowStyle(item)}>
                  <div style={{ paddingLeft: `${(item.nivel - 1) * 20}px` }}>
                    {item.nome}
                  </div>
                </TableCell>
                <TableCell className={getValueStyle(item)}>
                  {formatCurrency(item.valor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
