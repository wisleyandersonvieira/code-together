'use client';

import React, { useEffect, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { UpdateSomaButton } from '@/components/UpdateSomaButton';
import { usePdfExport } from '@/hooks/use-pdf-export';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import loadEstruturaDreItensAction from '@/actions/loadEstruturaDreItens';
import loadDreContasPagarAction from '@/actions/loadDreContasPagar';
import loadDreContasReceberAction from '@/actions/loadDreContasReceber';
import loadAportesAction from '@/actions/loadAportes';
import loadRetiradasAction from '@/actions/loadRetiradas';
import loadDreEmprestimosAction from '@/actions/loadDreEmprestimos';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';

interface DreDataLoaderProps {
  estruturaId: number;
  matrizId: number;
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

export function DreDataLoader({ estruturaId, matrizId, tipoData, dataInicio, dataFim, onComplete, refreshTrigger }: DreDataLoaderProps) {
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

  // Load financial data
  const [contasPagar, loadingContasPagar] = useLoadAction(
    loadDreContasPagarAction,
    [],
    { matrizId, tipoData, dataInicio, dataFim, estruturaId }
  );

  const [contasReceber, loadingContasReceber] = useLoadAction(
    loadDreContasReceberAction,
    [],
    { matrizId, tipoData, dataInicio, dataFim, estruturaId }
  );

  const [aportes, loadingAportes] = useLoadAction(
    loadAportesAction,
    [],
    { matrizId, dataInicio, dataFim }
  );

  const [retiradas, loadingRetiradas] = useLoadAction(
    loadRetiradasAction,
    [],
    { matrizId, dataInicio, dataFim }
  );

  const [emprestimos, loadingEmprestimos] = useLoadAction(
    loadDreEmprestimosAction,
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

  const isLoading = loadingItens || loadingContasPagar || loadingContasReceber || loadingAportes || loadingRetiradas || loadingEmprestimos;

  // Reset calculation when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      setHasCalculated(false);
      refreshEstrutura();
    }
  }, [refreshTrigger, refreshEstrutura]);

  useEffect(() => {
    if (!isLoading && estruturaItens && contasPagar && contasReceber && aportes && retiradas && emprestimos && !hasCalculated) {
      console.log('Processando DRE - estruturaItens:', estruturaItens);
      
      // Process and calculate values for each structure item
      const processedItems: DreItemResult[] = estruturaItens.map((item: any) => {
        let valor = 0;

        if (item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
          console.log(`Processando subgrupo: ${item.nome}, função: ${item.subgrupo_funcao}`);
          // Calculate value from contas pagar/receber
          // Use Number() to handle PostgreSQL NUMERIC types returned as strings
          const contasPagarValues = contasPagar
            .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
            .reduce((sum: number, cp: any) => sum + (Number(cp.valor_total) || 0), 0);

          const contasReceberValues = contasReceber
            .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
            .reduce((sum: number, cr: any) => sum + (Number(cr.valor_total) || 0), 0);

          valor = contasPagarValues + contasReceberValues;

          // Apply sign based on function from structure (débito = negative, crédito = positive)
          console.log(`Subgrupo ${item.nome}: valor antes=${valor}, função=${item.subgrupo_funcao}`);
          if (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO') {
            valor = -valor;
            console.log(`Aplicado sinal negativo: ${valor}`);
          }
        } else if (item.tipo === 'APORTE') {
          // Sum all aportes (positive)
          valor = aportes.reduce((sum: number, aporte: any) => sum + (Number(aporte.valor) || 0), 0);
        } else if (item.tipo === 'RETIRADA') {
          // Sum all retiradas (negative)
          valor = -retiradas.reduce((sum: number, retirada: any) => sum + (Number(retirada.valor) || 0), 0);
        } else if (item.tipo === 'EMPRESTIMO_ENTRADA') {
          // Pagamentos de empréstimo entram no caixa (positive)
          valor = emprestimos
            .filter((e: any) => e.tipo === 'PAGAMENTO')
            .reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
        } else if (item.tipo === 'EMPRESTIMO_SAIDA') {
          // Empréstimos concedidos saem do caixa (negative)
          valor = -emprestimos
            .filter((e: any) => e.tipo === 'EMPRESTIMO')
            .reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
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
                  .reduce((sum: number, cp: any) => sum + (Number(cp.valor_total) || 0), 0);

                const contasReceberValues = contasReceber
                  .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(subitem.subgrupo_contabil_id))
                  .reduce((sum: number, cr: any) => sum + (Number(cr.valor_total) || 0), 0);

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
          console.log(`Processando SOMA ${item.nome} (ordem: ${item.ordem})`);
          
          // Sum only SUBGRUPOS, APORTES e RETIRADAS above this SOMA line (exclude GRUPOS to avoid duplication)
          const itemsAbove = sortedItems.slice(0, index).filter(aboveItem => 
            aboveItem.tipo === 'SUBGRUPO' || 
            aboveItem.tipo === 'APORTE' || 
            aboveItem.tipo === 'RETIRADA' ||
            aboveItem.tipo === 'EMPRESTIMO_ENTRADA' ||
            aboveItem.tipo === 'EMPRESTIMO_SAIDA'
          );
          
          const somaValue = itemsAbove.reduce((sum: number, aboveItem) => {
            console.log(`SOMA ${item.nome} - somando item ${aboveItem.nome} (${aboveItem.tipo}): ${aboveItem.valor}`);
            return sum + aboveItem.valor;
          }, 0);
          
          console.log(`SOMA ${item.nome} - valor final calculado: ${somaValue}`);
          return { ...item, valor: somaValue };
        }
        return item;
      });

      console.log('Dados finais do DRE:', finalItems);
      setDreData(finalItems.sort((a, b) => a.ordem - b.ordem));
      setHasCalculated(true);
      onComplete();
    }
  }, [isLoading, estruturaItens, contasPagar, contasReceber, aportes, retiradas, emprestimos, hasCalculated, onComplete]);



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
    
    // Para RETIRADAS e EMPRÉSTIMOS SAÍDA sempre vermelho (valores já negativos)
    if (item.tipo === 'RETIRADA' || item.tipo === 'EMPRESTIMO_SAIDA') {
      return `${baseStyle} text-red-600`;
    }
    
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
      'Demonstrativo de Resultado do Exercício',
      {
        dataInicio,
        dataFim,
        tipoData,
        estruturaNome,
        matrizNome,
      },
      {
        aportes,
        retiradas,
        emprestimos,
      }
    );

    if (success) {
      toast({
        title: 'Sucesso',
        description: 'Relatório DRE exportado com sucesso!',
      });
    } else {
      toast({
        title: 'Erro',
        description: 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  const handleExportExcel = () => {
    if (!dreData || dreData.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há dados para exportar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const estruturaNome = estruturas?.find((e: any) => e.id === estruturaId)?.nome || 'N/A';
      const matrizNome = matrizes?.find((m: any) => m.id === matrizId)?.nome || 'N/A';

      // Preparar dados para Excel
      const excelData = dreData.map((item) => ({
        Ordem: item.ordem,
        Tipo: item.tipo,
        Nome: item.nome,
        Valor: item.valor,
      }));

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([]);

      // Adicionar cabeçalho com informações do relatório
      XLSX.utils.sheet_add_aoa(ws, [
        ['Demonstrativo de Resultado do Exercício'],
        [''],
        ['Estrutura:', estruturaNome],
        ['Matriz:', matrizNome],
        ['Período:', `${dataInicio} a ${dataFim}`],
        ['Critério:', tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'],
        [''],
        ['Ordem', 'Tipo', 'Nome', 'Valor'],
      ]);

      // Adicionar dados do DRE
      XLSX.utils.sheet_add_json(ws, excelData, {
        origin: 'A9',
        skipHeader: true,
      });

      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 10 },  // Ordem
        { wch: 15 },  // Tipo
        { wch: 50 },  // Nome
        { wch: 20 },  // Valor
      ];

      // Aplicar formatação de moeda na coluna Valor
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 8; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: 3 }); // Coluna D (Valor)
        if (!ws[cellAddress]) continue;
        ws[cellAddress].z = '#,##0.00';
      }

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'DRE');

      // Gerar arquivo
      const fileName = `DRE_${matrizNome}_${dataInicio}_${dataFim}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Sucesso',
        description: 'Relatório DRE exportado para Excel com sucesso!',
      });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao exportar o relatório para Excel.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Carregando dados do DRE...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Período: {dataInicio} a {dataFim} | 
          Critério: {tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'}
        </div>
        <div className="flex gap-2">
          <UpdateSomaButton
            dreData={dreData}
            onSomaUpdated={setDreData}
            estruturaItens={estruturaItens || []}
          />
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
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
            {dreData.filter((item) => item.valor !== 0).map((item) => (
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
