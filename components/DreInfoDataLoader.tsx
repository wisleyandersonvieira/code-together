'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { exportDreInfoToPDF } from '@/utils/dre-info-export';
import * as XLSX from 'xlsx';
import loadEstruturaDreItensAction from '@/actions/loadEstruturaDreItens';
import loadDreInfoContasPagarAction from '@/actions/loadDreInfoContasPagar';
import loadDreInfoContasReceberAction from '@/actions/loadDreInfoContasReceber';
import loadAportesAction from '@/actions/loadAportes';
import loadRetiradasAction from '@/actions/loadRetiradas';
import loadEmprestimosAction from '@/actions/loadEmprestimos';
import loadEstruturasDreAction from '@/actions/loadEstruturasDre';
import loadMatrizesAction from '@/actions/loadMatrizes';
import { DreInfoSubgrupoDetalhe } from '@/components/DreInfoSubgrupoDetalhe';

interface DreInfoDataLoaderProps {
  estruturaId: number;
  matrizIds: number[];
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
  projetoIds?: number[];
  contaIds?: number[];
  statusProjeto?: string;
  projetoNome?: string;
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
  valorGeral: number;
  valorAndamento: number;
  valorConcluido: number;
  parent_id?: number;
}


export function DreInfoDataLoader({
  estruturaId,
  matrizIds,
  tipoData,
  dataInicio,
  dataFim,
  projetoIds,
  contaIds,
  statusProjeto,
  projetoNome,
  onComplete,
  refreshTrigger,
}: DreInfoDataLoaderProps) {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  const [dreData, setDreData] = useState<DreItemResult[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [expandedDetailData, setExpandedDetailData] = useState<Map<number, any[]>>(new Map());

  // Callback for DreInfoSubgrupoDetalhe to report loaded data
  const handleSubgrupoDataLoaded = useCallback((subgrupoId: number, items: any[]) => {
    setExpandedDetailData((prev) => {
      const next = new Map(prev);
      next.set(subgrupoId, items);
      return next;
    });
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────────

  const [estruturaItens, loadingItens, , refreshEstrutura] = useLoadAction(
    loadEstruturaDreItensAction,
    [],
    { estruturaId }
  );

  const [contasPagar, loadingContasPagar] = useLoadAction(
    loadDreInfoContasPagarAction,
    [],
    { matrizIds, tipoData, dataInicio, dataFim, estruturaId, projetoIds, contaIds, statusProjeto }
  );

  const [contasReceber, loadingContasReceber] = useLoadAction(
    loadDreInfoContasReceberAction,
    [],
    { matrizIds, tipoData, dataInicio, dataFim, estruturaId, projetoIds, contaIds, statusProjeto }
  );

  const [aportesRaw, loadingAportes] = useLoadAction(loadAportesAction, [], {
    matrizIds,
    contaIds,
    tipoData,
    dataInicio,
    dataFim,
  });

  const [retiradasRaw, loadingRetiradas] = useLoadAction(loadRetiradasAction, [], {
    matrizIds,
    contaIds,
    tipoData,
    dataInicio,
    dataFim,
  });

  // exportAll ignora a paginação da listagem: o DRE precisa de todos os registros
  const [emprestimosRaw, loadingEmprestimos] = useLoadAction(loadEmprestimosAction, [], {
    matrizIds,
    contaIds,
    tipoData,
    dataInicio,
    dataFim,
    exportAll: true,
  });

  // Com filtro de status de projeto ativo, exibimos apenas lançamentos com
  // projeto vinculado — aportes, retiradas e empréstimos não têm vínculo.
  const semVinculoProjeto = Boolean(statusProjeto);
  const aportes = semVinculoProjeto ? [] : aportesRaw;
  const retiradas = semVinculoProjeto ? [] : retiradasRaw;
  const emprestimos = semVinculoProjeto ? [] : emprestimosRaw;

  // EMPRESTIMO = saída de caixa · PAGAMENTO = entrada de caixa
  const emprestimosSaida = (emprestimos as any[]).filter((e) => e.tipo === 'EMPRESTIMO');
  const emprestimosEntrada = (emprestimos as any[]).filter((e) => e.tipo === 'PAGAMENTO');

  const [estruturas] = useLoadAction(loadEstruturasDreAction, []);
  const [matrizes] = useLoadAction(loadMatrizesAction, [], { searchNome: null });

  const isLoading =
    loadingItens ||
    loadingContasPagar ||
    loadingContasReceber ||
    loadingAportes ||
    loadingRetiradas ||
    loadingEmprestimos;

  // ── Reset on refresh ────────────────────────────────────────────────────────

  useEffect(() => {
    if (refreshTrigger !== undefined) {
      setHasCalculated(false);
      setExpandedRows(new Set());
      refreshEstrutura();
    }
  }, [refreshTrigger, refreshEstrutura]);

  // ── DRE Calculation (same logic as DreDataLoader) ───────────────────────────

  useEffect(() => {
    if (
      !isLoading &&
      estruturaItens &&
      contasPagar &&
      contasReceber &&
      aportes &&
      retiradas &&
      emprestimos &&
      !hasCalculated
    ) {
      const processedItems: DreItemResult[] = estruturaItens.map((item: any) => {
        let valor = 0;

        if (item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
          const cpSum = contasPagar
            .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
            .reduce((sum: number, cp: any) => sum + (Number(cp.valor_total) || 0), 0);

          const crSum = contasReceber
            .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(item.subgrupo_contabil_id))
            .reduce((sum: number, cr: any) => sum + (Number(cr.valor_total) || 0), 0);

          valor = cpSum + crSum;

          if (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO') {
            valor = -valor;
          }
        } else if (item.tipo === 'APORTE') {
          valor = aportes.reduce((sum: number, a: any) => sum + (Number(a.valor) || 0), 0);
        } else if (item.tipo === 'RETIRADA') {
          valor = -retiradas.reduce((sum: number, r: any) => sum + (Number(r.valor) || 0), 0);
        } else if (item.tipo === 'EMPRESTIMO_ENTRADA') {
          valor = emprestimosEntrada.reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
        } else if (item.tipo === 'EMPRESTIMO_SAIDA') {
          valor = -emprestimosSaida.reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
        } else if (item.tipo === 'GRUPO') {
          valor = estruturaItens
            .filter((sub: any) => sub.tipo === 'SUBGRUPO' && sub.parent_id === item.id)
            .reduce((sum: number, sub: any) => {
              let subVal = 0;
              if (sub.subgrupo_contabil_id) {
                const cpS = contasPagar
                  .filter((cp: any) => Number(cp.subgrupo_contabil_id) === Number(sub.subgrupo_contabil_id))
                  .reduce((s: number, cp: any) => s + (Number(cp.valor_total) || 0), 0);
                const crS = contasReceber
                  .filter((cr: any) => Number(cr.subgrupo_contabil_id) === Number(sub.subgrupo_contabil_id))
                  .reduce((s: number, cr: any) => s + (Number(cr.valor_total) || 0), 0);
                subVal = cpS + crS;
                if (sub.subgrupo_funcao === 'Débito' || sub.subgrupo_funcao === 'DEBITO') {
                  subVal = -subVal;
                }
              }
              return sum + subVal;
            }, 0);
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

      const sortedItems = processedItems.sort((a, b) => a.ordem - b.ordem);

      const finalItems = sortedItems.map((item, index) => {
        if (item.tipo === 'SOMA') {
          const itemsAbove = sortedItems
            .slice(0, index)
            .filter(
              (above) =>
                above.tipo === 'SUBGRUPO' ||
                above.tipo === 'APORTE' ||
                above.tipo === 'RETIRADA' ||
                above.tipo === 'EMPRESTIMO_ENTRADA' ||
                above.tipo === 'EMPRESTIMO_SAIDA'
            );
          const somaValue = itemsAbove.reduce((sum, above) => sum + above.valor, 0);
          return { ...item, valor: somaValue };
        }
        return item;
      });

      setDreData(finalItems.sort((a, b) => a.ordem - b.ordem));
      setHasCalculated(true);
      onComplete();
    }
  }, [isLoading, estruturaItens, contasPagar, contasReceber, aportes, retiradas, emprestimos, hasCalculated, onComplete]);

  // ── Expand / collapse ───────────────────────────────────────────────────────

  const toggleRow = useCallback((itemId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const isExpandable = (item: DreItemResult) =>
    item.tipo === 'SUBGRUPO' ||
    item.tipo === 'APORTE' ||
    item.tipo === 'RETIRADA' ||
    item.tipo === 'EMPRESTIMO_ENTRADA' ||
    item.tipo === 'EMPRESTIMO_SAIDA';

  // ── Visual helpers (same as DreDataLoader) ──────────────────────────────────

  const getItemTypeBadge = (tipo: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      GRUPO: 'default',
      SUBGRUPO: 'secondary',
      SOMA: 'outline',
      APORTE: 'default',
      RETIRADA: 'destructive',
      EMPRESTIMO_ENTRADA: 'default',
      EMPRESTIMO_SAIDA: 'destructive',
    };
    return <Badge variant={variants[tipo] || 'default'}>{tipo}</Badge>;
  };

  const getRowStyle = (item: DreItemResult) =>
    item.tipo === 'GRUPO' || item.tipo === 'SOMA' ? 'font-bold' : '';

  const getValueStyle = (item: DreItemResult) => {
    const base = `text-right ${getRowStyle(item)}`;
    if (item.tipo === 'RETIRADA' || item.tipo === 'EMPRESTIMO_SAIDA') return `${base} text-red-600`;
    if (item.tipo === 'SUBGRUPO' && (item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO'))
      return `${base} text-red-600`;
    if (item.tipo === 'GRUPO' && item.valor < 0) return `${base} text-red-600`;
    if (item.valor < 0) return `${base} text-red-600`;
    return `${base} text-green-600`;
  };

  // ── PDF export (novo padrão executivo premium) ──────────────────────────────

  const handleExportPdf = () => {
    if (!dreData || dreData.length === 0) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }
    try {
      const estruturaNome = estruturas?.find((e: any) => e.id === estruturaId)?.nome || 'N/A';
      const matrizNome    = (matrizes || []).filter((m: any) => (matrizIds || []).includes(Number(m.id))).map((m: any) => m.nome).join(', ') || 'Todas';

      exportDreInfoToPDF(
        dreData,
        aportes     || [],
        retiradas   || [],
        emprestimos || [],
        { dataInicio, dataFim, tipoData, estruturaNome, matrizNome, projetoNome },
        formatCurrency,
      );

      toast({ title: 'Sucesso', description: 'PDF exportado com sucesso!' });
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast({ title: 'Erro', description: 'Falha ao gerar o PDF.', variant: 'destructive' });
    }
  };

  // ── Excel export (Sheet 1 = consolidado · Sheet 2 = detalhamento) ───────────

  const handleExportExcel = () => {
    if (!dreData || dreData.length === 0) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }

    try {
      const estruturaNome = estruturas?.find((e: any) => e.id === estruturaId)?.nome || 'N/A';
      const matrizNome = (matrizes || []).filter((m: any) => (matrizIds || []).includes(Number(m.id))).map((m: any) => m.nome).join(', ') || 'Todas';

      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Consolidado ──────────────────────────────────────────────

      const ws1 = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws1, [
        ['DRE Info – Demonstrativo Analítico'],
        [''],
        ['Estrutura:', estruturaNome],
        ['Matriz:', matrizNome],
        projetoNome ? ['Projeto:', projetoNome] : ['Projeto:', 'Todos'],
        ['Período:', `${dataInicio} a ${dataFim}`],
        ['Critério:', tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'],
        [''],
        ['Ordem', 'Tipo', 'Nome', 'Valor'],
      ]);

      // Build rows interleaving expanded detail
      const consolidadoRows: any[][] = [];
      dreData.forEach((item) => {
        consolidadoRows.push([item.ordem, item.tipo, item.nome, item.valor]);

        // If this subgrupo is expanded and we have detail data, add detail rows
        if (expandedRows.has(item.id) && item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
          const details = expandedDetailData.get(item.subgrupo_contabil_id);
          if (details && details.length > 0) {
            const isDebito = item.subgrupo_funcao === 'Débito' || item.subgrupo_funcao === 'DEBITO';
            // Sub-header
            consolidadoRows.push(['', '', '  ↳ Data', '  Favorecido', '  Observação', '  Projetos', '  Valor']);
            details.forEach((d: any) => {
              consolidadoRows.push([
                '',
                '',
                `    ${d.data_referencia || '-'}`,
                d.favorecido || '-',
                d.observacao || '',
                d.projetos || '',
                d.valor || 0,
              ]);
            });
          }
        }

        // If APORTE expanded, add aporte detail rows
        if (expandedRows.has(item.id) && item.tipo === 'APORTE' && aportes && aportes.length > 0) {
          consolidadoRows.push(['', '', '  ↳ Data', '  Sócio', '  Valor']);
          (aportes as any[]).forEach((a) => {
            consolidadoRows.push(['', '', `    ${a.data_aporte || '-'}`, a.socio_nome || '-', '', '', Number(a.valor) || 0]);
          });
        }

        // If RETIRADA expanded, add retirada detail rows
        if (expandedRows.has(item.id) && item.tipo === 'RETIRADA' && retiradas && retiradas.length > 0) {
          consolidadoRows.push(['', '', '  ↳ Data', '  Sócio', '  Valor']);
          (retiradas as any[]).forEach((r) => {
            consolidadoRows.push(['', '', `    ${r.data_retirada || '-'}`, r.socio_nome || '-', '', '', Number(r.valor) || 0]);
          });
        }

        // If EMPRESTIMO_ENTRADA expanded, add pagamento detail rows
        if (expandedRows.has(item.id) && item.tipo === 'EMPRESTIMO_ENTRADA' && emprestimosEntrada.length > 0) {
          consolidadoRows.push(['', '', '  ↳ Data', '  Sócio', '  Valor']);
          emprestimosEntrada.forEach((e: any) => {
            consolidadoRows.push(['', '', `    ${e.data_emprestimo || '-'}`, e.socio_nome || '-', '', '', Number(e.valor) || 0]);
          });
        }

        // If EMPRESTIMO_SAIDA expanded, add empréstimo detail rows
        if (expandedRows.has(item.id) && item.tipo === 'EMPRESTIMO_SAIDA' && emprestimosSaida.length > 0) {
          consolidadoRows.push(['', '', '  ↳ Data', '  Sócio', '  Valor']);
          emprestimosSaida.forEach((e: any) => {
            consolidadoRows.push(['', '', `    ${e.data_emprestimo || '-'}`, e.socio_nome || '-', '', '', Number(e.valor) || 0]);
          });
        }
      });

      XLSX.utils.sheet_add_aoa(ws1, consolidadoRows, { origin: 'A10' });

      // Adjust columns for possible expanded detail
      ws1['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 25 }, { wch: 22 }];

      const range1 = XLSX.utils.decode_range(ws1['!ref'] || 'A1');
      for (let R = 9; R <= range1.e.r; ++R) {
        // Format value columns: D (index 3) for main rows, G (index 6) for detail rows
        for (const colIdx of [3, 6]) {
          const cell = XLSX.utils.encode_cell({ r: R, c: colIdx });
          if (ws1[cell] && typeof ws1[cell].v === 'number') ws1[cell].z = '#,##0.00';
        }
      }

      XLSX.utils.book_append_sheet(wb, ws1, 'Consolidado');

      // ── Sheet 2: Detalhamento (raw transactions from loaded data) ─────────

      const ws2 = XLSX.utils.json_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws2, [
        ['DRE Info – Detalhamento de Transações'],
        [''],
        ['Estrutura:', estruturaNome],
        ['Matriz:', matrizNome],
        projetoNome ? ['Projeto:', projetoNome] : ['Projeto:', 'Todos'],
        ['Período:', `${dataInicio} a ${dataFim}`],
        ['Critério:', tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'],
        [''],
        ['Subgrupo DRE', 'Tipo Lançamento', 'Data Referência', 'Valor'],
      ]);

      // Build detail rows from raw contasPagar / contasReceber (already loaded)
      // We enrich with the subgrupo name via estruturaItens
      const subgrupoNameMap = new Map<number, string>();
      (estruturaItens || []).forEach((item: any) => {
        if (item.subgrupo_contabil_id) {
          subgrupoNameMap.set(Number(item.subgrupo_contabil_id), item.nome);
        }
      });

      const detalheRows: any[] = [];

      (contasPagar || []).forEach((cp: any) => {
        const subNome = subgrupoNameMap.get(Number(cp.subgrupo_contabil_id)) || `Subgrupo ${cp.subgrupo_contabil_id}`;
        detalheRows.push({
          'Subgrupo DRE': subNome,
          'Tipo Lançamento': 'Pagar',
          'Data Referência': cp.data_referencia || '',
          Valor: Number(cp.valor_total) || 0,
        });
      });

      (contasReceber || []).forEach((cr: any) => {
        const subNome = subgrupoNameMap.get(Number(cr.subgrupo_contabil_id)) || `Subgrupo ${cr.subgrupo_contabil_id}`;
        detalheRows.push({
          'Subgrupo DRE': subNome,
          'Tipo Lançamento': 'Receber',
          'Data Referência': cr.data_referencia || '',
          Valor: Number(cr.valor_total) || 0,
        });
      });

      detalheRows.sort((a, b) => {
        if (a['Subgrupo DRE'] < b['Subgrupo DRE']) return -1;
        if (a['Subgrupo DRE'] > b['Subgrupo DRE']) return 1;
        return (a['Data Referência'] || '').localeCompare(b['Data Referência'] || '');
      });

      XLSX.utils.sheet_add_json(ws2, detalheRows, { origin: 'A10', skipHeader: true });

      ws2['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];

      const range2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1');
      for (let R = 9; R <= range2.e.r; ++R) {
        const cell = XLSX.utils.encode_cell({ r: R, c: 3 });
        if (ws2[cell]) ws2[cell].z = '#,##0.00';
      }

      XLSX.utils.book_append_sheet(wb, ws2, 'Detalhamento');

      // ── Sheet 3: Aportes ──────────────────────────────────────────────────

      if (aportes && aportes.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(ws3, [['Data', 'Sócio', 'Valor']]);
        XLSX.utils.sheet_add_json(
          ws3,
          (aportes as any[]).map((a) => ({
            Data: a.data_aporte || '',
            Sócio: a.socio_nome || '',
            Valor: Number(a.valor) || 0,
          })),
          { origin: 'A2', skipHeader: true }
        );
        ws3['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws3, 'Aportes');
      }

      // ── Sheet 4: Retiradas ────────────────────────────────────────────────

      if (retiradas && retiradas.length > 0) {
        const ws4 = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(ws4, [['Data', 'Sócio', 'Valor']]);
        XLSX.utils.sheet_add_json(
          ws4,
          (retiradas as any[]).map((r) => ({
            Data: r.data_retirada || '',
            Sócio: r.socio_nome || '',
            Valor: Number(r.valor) || 0,
          })),
          { origin: 'A2', skipHeader: true }
        );
        ws4['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws4, 'Retiradas');
      }

      // ── Sheet 5: Empréstimos ──────────────────────────────────────────────

      if (emprestimos && emprestimos.length > 0) {
        const ws5 = XLSX.utils.json_to_sheet([]);
        XLSX.utils.sheet_add_aoa(ws5, [['Data', 'Tipo', 'Sócio', 'Valor']]);
        XLSX.utils.sheet_add_json(
          ws5,
          (emprestimos as any[]).map((e) => ({
            Data: e.data_emprestimo || '',
            Tipo: e.tipo === 'PAGAMENTO' ? 'Pagamento' : 'Empréstimo',
            Sócio: e.socio_nome || '',
            // Empréstimo sai do caixa (negativo), pagamento entra (positivo)
            Valor: (e.tipo === 'PAGAMENTO' ? 1 : -1) * (Number(e.valor) || 0),
          })),
          { origin: 'A2', skipHeader: true }
        );
        ws5['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, ws5, 'Empréstimos');
      }

      const matrizNomeClean = matrizNome.replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `DRE_Info_${matrizNomeClean}_${dataInicio}_${dataFim}.xlsx`);

      toast({ title: 'Sucesso', description: 'Excel exportado com sucesso!' });
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast({ title: 'Erro', description: 'Falha ao exportar o Excel.', variant: 'destructive' });
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <span className="animate-pulse">Carregando dados do DRE Info...</span>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Info bar + export buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Período: <strong>{dataInicio}</strong> a <strong>{dataFim}</strong> &nbsp;|&nbsp;
          Critério:{' '}
          <strong>{tipoData === 'competencia' ? 'Data de Competência' : 'Data de Pagamento'}</strong>
          {projetoNome && (
            <>
              &nbsp;|&nbsp; Projeto: <strong>{projetoNome}</strong>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
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

      {/* Hint */}
      <p className="text-xs text-muted-foreground italic">
        Clique na seta ao lado de um <Badge variant="secondary" className="text-[10px] px-1 py-0">SUBGRUPO</Badge>,{' '}
        <Badge variant="default" className="text-[10px] px-1 py-0">APORTE</Badge> ou{' '}
        <Badge variant="destructive" className="text-[10px] px-1 py-0">RETIRADA</Badge>,{' '}
        <Badge variant="default" className="text-[10px] px-1 py-0">EMPRESTIMO_ENTRADA</Badge> ou{' '}
        <Badge variant="destructive" className="text-[10px] px-1 py-0">EMPRESTIMO_SAIDA</Badge> para expandir os lançamentos.
      </p>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dreData.filter((item) => item.valor !== 0).map((item) => {
              const expanded = expandedRows.has(item.id);
              const expandable = isExpandable(item);

              return (
                <React.Fragment key={item.id}>
                  {/* ── Main consolidated row ─────────────────────────────── */}
                  <TableRow
                    className={`${getRowStyle(item)} ${
                      item.tipo === 'GRUPO' ? 'bg-slate-100/70' : ''
                    } ${item.tipo === 'SOMA' ? 'border-t-2 border-slate-300' : ''}`}
                  >
                    {/* Ordem + badge */}
                    <TableCell>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {item.ordem}
                        {getItemTypeBadge(item.tipo)}
                      </div>
                    </TableCell>

                    {/* Nome com ícone de expandir */}
                    <TableCell className={getRowStyle(item)}>
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${(item.nivel - 1) * 20}px` }}
                      >
                        {expandable ? (
                          <button
                            onClick={() => toggleRow(item.id)}
                            className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                            title={expanded ? 'Recolher detalhe' : 'Expandir detalhe'}
                          >
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-5 flex-shrink-0" />
                        )}
                        {item.nome}
                      </div>
                    </TableCell>

                    {/* Valor */}
                    <TableCell className={getValueStyle(item)}>
                      {formatCurrency(item.valor)}
                    </TableCell>
                  </TableRow>

                  {/* ── Expanded detail: SUBGRUPO ─────────────────────────── */}
                  {expanded && item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id && (
                    <DreInfoSubgrupoDetalhe
                      matrizIds={matrizIds}
                      subgrupoId={item.subgrupo_contabil_id}
                      tipoData={tipoData}
                      dataInicio={dataInicio}
                      dataFim={dataFim}
                      projetoIds={projetoIds}
                      contaIds={contaIds}
                      statusProjeto={statusProjeto}
                      funcao={item.subgrupo_funcao}
                      nivel={item.nivel}
                      onDataLoaded={handleSubgrupoDataLoaded}
                    />
                  )}

                  {/* ── Expanded detail: APORTE ───────────────────────────── */}
                  {expanded && item.tipo === 'APORTE' && (
                    <>
                      {(!aportes || aportes.length === 0) ? (
                        <TableRow className="bg-slate-50/60">
                          <TableCell colSpan={3} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhum aporte encontrado no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-blue-50/60 hover:bg-blue-50/60">
                            <TableCell colSpan={3} className="py-1 px-4">
                              <div
                                className="grid text-xs font-semibold text-slate-500 border-l-2 border-blue-300 pl-3"
                                style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                              >
                                <span>Data</span>
                                <span>Sócio</span>
                                <span className="text-right">Valor</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {(aportes as any[]).map((aporte, idx) => (
                            <TableRow
                              key={`aporte_${idx}`}
                              className="bg-slate-50/40 hover:bg-blue-50/30 border-b border-slate-100"
                            >
                              <TableCell colSpan={3} className="py-1 px-4">
                                <div
                                  className="grid text-xs items-center border-l-2 border-blue-100 pl-3"
                                  style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                                >
                                  <span className="text-muted-foreground font-mono">
                                    {aporte.data_aporte
                                      ? new Date(aporte.data_aporte + 'T00:00:00').toLocaleDateString('pt-BR')
                                      : '-'}
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {aporte.socio_nome || '-'}
                                  </span>
                                  <span className="text-right font-mono font-medium text-green-700">
                                    {formatCurrency(Number(aporte.valor) || 0)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* ── Expanded detail: RETIRADA ─────────────────────────── */}
                  {expanded && item.tipo === 'RETIRADA' && (
                    <>
                      {(!retiradas || retiradas.length === 0) ? (
                        <TableRow className="bg-slate-50/60">
                          <TableCell colSpan={3} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhuma retirada encontrada no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-red-50/60 hover:bg-red-50/60">
                            <TableCell colSpan={3} className="py-1 px-4">
                              <div
                                className="grid text-xs font-semibold text-slate-500 border-l-2 border-red-300 pl-3"
                                style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                              >
                                <span>Data</span>
                                <span>Sócio</span>
                                <span className="text-right">Valor</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {(retiradas as any[]).map((retirada, idx) => (
                            <TableRow
                              key={`retirada_${idx}`}
                              className="bg-slate-50/40 hover:bg-red-50/30 border-b border-slate-100"
                            >
                              <TableCell colSpan={3} className="py-1 px-4">
                                <div
                                  className="grid text-xs items-center border-l-2 border-red-100 pl-3"
                                  style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                                >
                                  <span className="text-muted-foreground font-mono">
                                    {retirada.data_retirada
                                      ? new Date(retirada.data_retirada + 'T00:00:00').toLocaleDateString('pt-BR')
                                      : '-'}
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {retirada.socio_nome || '-'}
                                  </span>
                                  <span className="text-right font-mono font-medium text-red-600">
                                    {formatCurrency(Number(retirada.valor) || 0)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {/* ── Expanded detail: EMPRESTIMO_ENTRADA (pagamentos) ──── */}
                  {expanded && item.tipo === 'EMPRESTIMO_ENTRADA' && (
                    <>
                      {emprestimosEntrada.length === 0 ? (
                        <TableRow className="bg-slate-50/60">
                          <TableCell colSpan={3} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhum pagamento de empréstimo encontrado no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-blue-50/60 hover:bg-blue-50/60">
                            <TableCell colSpan={3} className="py-1 px-4">
                              <div
                                className="grid text-xs font-semibold text-slate-500 border-l-2 border-blue-300 pl-3"
                                style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                              >
                                <span>Data</span>
                                <span>Sócio</span>
                                <span className="text-right">Valor</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {emprestimosEntrada.map((registro: any, idx: number) => (
                            <TableRow
                              key={`emprestimo_entrada_${idx}`}
                              className="bg-slate-50/40 hover:bg-blue-50/30 border-b border-slate-100"
                            >
                              <TableCell colSpan={3} className="py-1 px-4">
                                <div
                                  className="grid text-xs items-center border-l-2 border-blue-100 pl-3"
                                  style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                                >
                                  <span className="text-muted-foreground font-mono">
                                    {registro.data_emprestimo
                                      ? new Date(String(registro.data_emprestimo).split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')
                                      : '-'}
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {registro.socio_nome || '-'}
                                  </span>
                                  <span className="text-right font-mono font-medium text-green-700">
                                    {formatCurrency(Number(registro.valor) || 0)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {/* ── Expanded detail: EMPRESTIMO_SAIDA (empréstimos) ───── */}
                  {expanded && item.tipo === 'EMPRESTIMO_SAIDA' && (
                    <>
                      {emprestimosSaida.length === 0 ? (
                        <TableRow className="bg-slate-50/60">
                          <TableCell colSpan={3} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhum empréstimo encontrado no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-red-50/60 hover:bg-red-50/60">
                            <TableCell colSpan={3} className="py-1 px-4">
                              <div
                                className="grid text-xs font-semibold text-slate-500 border-l-2 border-red-300 pl-3"
                                style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                              >
                                <span>Data</span>
                                <span>Sócio</span>
                                <span className="text-right">Valor</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {emprestimosSaida.map((registro: any, idx: number) => (
                            <TableRow
                              key={`emprestimo_saida_${idx}`}
                              className="bg-slate-50/40 hover:bg-red-50/30 border-b border-slate-100"
                            >
                              <TableCell colSpan={3} className="py-1 px-4">
                                <div
                                  className="grid text-xs items-center border-l-2 border-red-100 pl-3"
                                  style={{ marginLeft: `${item.nivel * 24}px`, gridTemplateColumns: '110px 1fr 120px' }}
                                >
                                  <span className="text-muted-foreground font-mono">
                                    {registro.data_emprestimo
                                      ? new Date(String(registro.data_emprestimo).split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')
                                      : '-'}
                                  </span>
                                  <span className="font-medium text-slate-700">
                                    {registro.socio_nome || '-'}
                                  </span>
                                  <span className="text-right font-mono font-medium text-red-600">
                                    {formatCurrency(Number(registro.valor) || 0)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      )}
                    </>
                  )}

                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
