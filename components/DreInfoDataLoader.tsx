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
import { ChevronDown, ChevronRight, Columns3, Download, FileSpreadsheet } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { exportDreInfoToPDF } from '@/utils/dre-info-export';
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
  const [separarColunas, setSepararColunas] = useState(false);
  // Só disponível sem filtro de status (todos os lançamentos)
  const podeSepararColunas = !statusProjeto;
  const colunasSeparadas = podeSepararColunas && separarColunas;
  const colCount = colunasSeparadas ? 6 : 3;
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
      // Soma de uma lista de lançamentos para um subgrupo, opcionalmente
      // ponderada pela fração de rateio por status de projeto.
      const somar = (rows: any[], subgrupoId: any, frac?: 'frac_geral' | 'frac_andamento' | 'frac_concluido') =>
        (rows || [])
          .filter((r: any) => Number(r.subgrupo_contabil_id) === Number(subgrupoId))
          .reduce(
            (sum: number, r: any) =>
              sum + (Number(r.valor_total) || 0) * (frac ? Number(r[frac]) || 0 : 1),
            0
          );

      const valoresSubgrupo = (sub: any) => {
        if (!sub.subgrupo_contabil_id) {
          return { valor: 0, valorGeral: 0, valorAndamento: 0, valorConcluido: 0 };
        }
        const sinal = sub.subgrupo_funcao === 'Débito' || sub.subgrupo_funcao === 'DEBITO' ? -1 : 1;
        const calc = (frac?: 'frac_geral' | 'frac_andamento' | 'frac_concluido') =>
          sinal *
          (somar(contasPagar as any[], sub.subgrupo_contabil_id, frac) +
            somar(contasReceber as any[], sub.subgrupo_contabil_id, frac));
        return {
          valor: calc(),
          valorGeral: calc('frac_geral'),
          valorAndamento: calc('frac_andamento'),
          valorConcluido: calc('frac_concluido'),
        };
      };

      const processedItems: DreItemResult[] = estruturaItens.map((item: any) => {
        let valor = 0;
        let valorGeral = 0;
        let valorAndamento = 0;
        let valorConcluido = 0;

        if (item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
          ({ valor, valorGeral, valorAndamento, valorConcluido } = valoresSubgrupo(item));
        } else if (item.tipo === 'APORTE') {
          valor = aportes.reduce((sum: number, a: any) => sum + (Number(a.valor) || 0), 0);
          valorGeral = valor;
        } else if (item.tipo === 'RETIRADA') {
          valor = -retiradas.reduce((sum: number, r: any) => sum + (Number(r.valor) || 0), 0);
          valorGeral = valor;
        } else if (item.tipo === 'EMPRESTIMO_ENTRADA') {
          valor = emprestimosEntrada.reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
          valorGeral = valor;
        } else if (item.tipo === 'EMPRESTIMO_SAIDA') {
          valor = -emprestimosSaida.reduce((sum: number, e: any) => sum + (Number(e.valor) || 0), 0);
          valorGeral = valor;
        } else if (item.tipo === 'GRUPO') {
          estruturaItens
            .filter((sub: any) => sub.tipo === 'SUBGRUPO' && sub.parent_id === item.id)
            .forEach((sub: any) => {
              const v = valoresSubgrupo(sub);
              valor += v.valor;
              valorGeral += v.valorGeral;
              valorAndamento += v.valorAndamento;
              valorConcluido += v.valorConcluido;
            });
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
          valorGeral,
          valorAndamento,
          valorConcluido,
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
          return {
            ...item,
            valor: itemsAbove.reduce((sum, a) => sum + a.valor, 0),
            valorGeral: itemsAbove.reduce((sum, a) => sum + a.valorGeral, 0),
            valorAndamento: itemsAbove.reduce((sum, a) => sum + a.valorAndamento, 0),
            valorConcluido: itemsAbove.reduce((sum, a) => sum + a.valorConcluido, 0),
          };
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

  // ── Excel export (Sheet 1 = consolidado formatado · demais = dados) ─────────

  const handleExportExcel = async () => {
    if (!dreData || dreData.length === 0) {
      toast({ title: 'Aviso', description: 'Não há dados para exportar.', variant: 'destructive' });
      return;
    }

    try {
      const ExcelJS = (await import('exceljs')).default;

      const estruturaNome = estruturas?.find((e: any) => e.id === estruturaId)?.nome || 'N/A';
      const matrizNome =
        (matrizes || [])
          .filter((m: any) => (matrizIds || []).includes(Number(m.id)))
          .map((m: any) => m.nome)
          .join(', ') || 'Todas';

      const MONEY = '_-"R$"\\ * #,##0.00_-;[Red]-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-';
      const GREEN = 'FFD7E4BC';
      const GREY = 'FFF2F2F2';

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Provison';

      // ── Sheet 1: DRE formatado ────────────────────────────────────────────
      const ws = wb.addWorksheet('DRE');
      ws.properties.defaultRowHeight = 16;

      const valueHeaders = colunasSeparadas
        ? ['Gerais', 'Projetos em Andamento', 'Projetos Concluídos', 'Total']
        : ['Valor'];
      const totalCols = 1 + valueHeaders.length;
      const lastColLetter = String.fromCharCode(64 + totalCols);

      ws.columns = [
        { width: 46 },
        ...valueHeaders.map(() => ({ width: 22 })),
      ];

      const addTitle = (text: string, size: number, bold = true) => {
        const row = ws.addRow([text]);
        ws.mergeCells(`A${row.number}:${lastColLetter}${row.number}`);
        row.getCell(1).font = { name: 'Arial', size, bold, color: { argb: 'FF111F3B' } };
        row.getCell(1).alignment = { horizontal: 'center' };
        return row;
      };

      addTitle('DRE Info – Demonstrativo Analítico', 14);
      addTitle(estruturaNome, 11);
      addTitle(
        `${matrizNome} · ${projetoNome || 'Todos os projetos'} · ${dataInicio} a ${dataFim} · ${
          tipoData === 'competencia' ? 'Competência' : 'Pagamento/Recebimento'
        }`,
        9,
        false,
      );
      ws.addRow([]);

      // Header
      const header = ws.addRow(['Descrição', ...valueHeaders]);
      header.eachCell((cell, col) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111F3B' } };
        cell.alignment = { horizontal: col === 1 ? 'left' : 'right', vertical: 'middle', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF9AA5B4' } } };
      });
      header.height = 22;

      const valuesOf = (item: any) =>
        colunasSeparadas
          ? [item.valorGeral, item.valorAndamento, item.valorConcluido, item.valor]
          : [item.valor];

      const styleValues = (row: any, opts: { bold?: boolean }) => {
        for (let c = 2; c <= totalCols; c++) {
          const cell = row.getCell(c);
          cell.numFmt = MONEY;
          cell.font = { name: 'Arial', size: 10, bold: !!opts.bold };
          cell.alignment = { horizontal: 'right' };
        }
      };

      dreData.forEach((item, index) => {
        const isGrupo = item.tipo === 'GRUPO';
        const isSoma = item.tipo === 'SOMA';
        const isTexto = item.tipo === 'TEXTO';

        if (isTexto) {
          const row = ws.addRow([item.nome]);
          row.getCell(1).font = { name: 'Arial', size: 10, bold: true, italic: true };
          return;
        }

        const row = ws.addRow([item.nome, ...valuesOf(item)]);
        row.getCell(1).font = {
          name: 'Arial',
          size: 10,
          bold: isGrupo || isSoma,
          color: { argb: 'FF111F3B' },
        };
        row.getCell(1).alignment = { horizontal: 'left', indent: isGrupo || isSoma ? 0 : 1 };
        styleValues(row, { bold: isGrupo || isSoma });

        if (isSoma) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF7F9A4F' } },
              bottom: { style: 'double', color: { argb: 'FF7F9A4F' } },
            };
          });
        } else if (isGrupo) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFB7BFCC' } } };
          });
        }

        // Detail rows (only when the row is expanded on screen)
        const pushDetalhe = (cells: (string | number)[]) => {
          const d = ws.addRow([cells[0], ...Array(totalCols - 2).fill(''), cells[1]]);
          d.getCell(1).font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } };
          d.getCell(1).alignment = { horizontal: 'left', indent: 3 };
          const v = d.getCell(totalCols);
          v.numFmt = MONEY;
          v.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } };
          v.alignment = { horizontal: 'right' };
        };

        if (expandedRows.has(item.id)) {
          if (item.tipo === 'SUBGRUPO' && item.subgrupo_contabil_id) {
            const details = expandedDetailData.get(item.subgrupo_contabil_id) || [];
            details.forEach((d: any) => {
              const partes = [d.data_referencia || '-', d.favorecido || '-', d.projetos, d.observacao]
                .filter(Boolean)
                .join(' · ');
              pushDetalhe([partes, Number(d.valor) || 0]);
            });
          } else if (item.tipo === 'APORTE') {
            (aportes as any[])?.forEach((a) =>
              pushDetalhe([`${a.data_aporte || '-'} · ${a.socio_nome || '-'}`, Number(a.valor) || 0]),
            );
          } else if (item.tipo === 'RETIRADA') {
            (retiradas as any[])?.forEach((r) =>
              pushDetalhe([`${r.data_retirada || '-'} · ${r.socio_nome || '-'}`, -(Number(r.valor) || 0)]),
            );
          } else if (item.tipo === 'EMPRESTIMO_ENTRADA') {
            emprestimosEntrada.forEach((e: any) =>
              pushDetalhe([`${e.data_emprestimo || '-'} · ${e.socio_nome || '-'}`, Number(e.valor) || 0]),
            );
          } else if (item.tipo === 'EMPRESTIMO_SAIDA') {
            emprestimosSaida.forEach((e: any) =>
              pushDetalhe([`${e.data_emprestimo || '-'} · ${e.socio_nome || '-'}`, -(Number(e.valor) || 0)]),
            );
          }
        }

        // Spacer after the end of a block (before the next GRUPO/SOMA)
        const next = dreData[index + 1];
        if (next && (next.tipo === 'GRUPO' || next.tipo === 'SOMA') && !isGrupo) {
          ws.addRow([]);
        }
      });

      ws.views = [{ state: 'frozen', ySplit: 5 }];

      // ── Sheet 2: Detalhamento (raw transactions) ──────────────────────────
      const subgrupoNameMap = new Map<number, string>();
      (estruturaItens || []).forEach((item: any) => {
        if (item.subgrupo_contabil_id) subgrupoNameMap.set(Number(item.subgrupo_contabil_id), item.nome);
      });

      const detalheRows: any[][] = [];
      (contasPagar || []).forEach((cp: any) =>
        detalheRows.push([
          subgrupoNameMap.get(Number(cp.subgrupo_contabil_id)) || `Subgrupo ${cp.subgrupo_contabil_id}`,
          'Pagar',
          cp.data_referencia || '',
          Number(cp.valor_total) || 0,
        ]),
      );
      (contasReceber || []).forEach((cr: any) =>
        detalheRows.push([
          subgrupoNameMap.get(Number(cr.subgrupo_contabil_id)) || `Subgrupo ${cr.subgrupo_contabil_id}`,
          'Receber',
          cr.data_referencia || '',
          Number(cr.valor_total) || 0,
        ]),
      );
      detalheRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])));

      const addSimpleSheet = (name: string, headers: string[], rows: any[][], widths: number[], moneyCol: number) => {
        const sheet = wb.addWorksheet(name);
        sheet.columns = widths.map((w) => ({ width: w }));
        const h = sheet.addRow(headers);
        h.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111F3B' } };
        });
        rows.forEach((r) => {
          const row = sheet.addRow(r);
          row.eachCell((cell) => (cell.font = { name: 'Arial', size: 10 }));
          const v = row.getCell(moneyCol);
          v.numFmt = MONEY;
          v.alignment = { horizontal: 'right' };
        });
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
      };

      addSimpleSheet(
        'Detalhamento',
        ['Subgrupo DRE', 'Tipo Lançamento', 'Data Referência', 'Valor'],
        detalheRows,
        [45, 18, 18, 22],
        4,
      );

      if (aportes && aportes.length > 0) {
        addSimpleSheet(
          'Aportes',
          ['Data', 'Sócio', 'Valor'],
          (aportes as any[]).map((a) => [a.data_aporte || '', a.socio_nome || '', Number(a.valor) || 0]),
          [14, 35, 20],
          3,
        );
      }

      if (retiradas && retiradas.length > 0) {
        addSimpleSheet(
          'Retiradas',
          ['Data', 'Sócio', 'Valor'],
          (retiradas as any[]).map((r) => [r.data_retirada || '', r.socio_nome || '', Number(r.valor) || 0]),
          [14, 35, 20],
          3,
        );
      }

      if (emprestimos && emprestimos.length > 0) {
        addSimpleSheet(
          'Empréstimos',
          ['Data', 'Tipo', 'Sócio', 'Valor'],
          (emprestimos as any[]).map((e) => [
            e.data_emprestimo || '',
            e.tipo === 'PAGAMENTO' ? 'Pagamento' : 'Empréstimo',
            e.socio_nome || '',
            (e.tipo === 'PAGAMENTO' ? 1 : -1) * (Number(e.valor) || 0),
          ]),
          [14, 14, 35, 20],
          4,
        );
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DRE_Info_${matrizNome.replace(/[^a-zA-Z0-9]/g, '_')}_${dataInicio}_${dataFim}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

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
          {podeSepararColunas && (
            <Button
              variant={separarColunas ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSepararColunas((v) => !v)}
            >
              <Columns3 className="mr-2 h-4 w-4" />
              Separar colunas
            </Button>
          )}
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
              {colunasSeparadas && (
                <>
                  <TableHead className="text-right">Gerais</TableHead>
                  <TableHead className="text-right">Projetos em andamento</TableHead>
                  <TableHead className="text-right">Projetos concluídos</TableHead>
                </>
              )}
              <TableHead className="text-right">Valor total</TableHead>
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
                    {colunasSeparadas && (
                      <>
                        <TableCell className={getValueStyle(item)}>
                          {formatCurrency(item.valorGeral)}
                        </TableCell>
                        <TableCell className={getValueStyle(item)}>
                          {formatCurrency(item.valorAndamento)}
                        </TableCell>
                        <TableCell className={getValueStyle(item)}>
                          {formatCurrency(item.valorConcluido)}
                        </TableCell>
                      </>
                    )}
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
                      colSpan={colCount}
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
                          <TableCell colSpan={colCount} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhum aporte encontrado no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-blue-50/60 hover:bg-blue-50/60">
                            <TableCell colSpan={colCount} className="py-1 px-4">
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
                              <TableCell colSpan={colCount} className="py-1 px-4">
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
                          <TableCell colSpan={colCount} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhuma retirada encontrada no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-red-50/60 hover:bg-red-50/60">
                            <TableCell colSpan={colCount} className="py-1 px-4">
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
                              <TableCell colSpan={colCount} className="py-1 px-4">
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
                          <TableCell colSpan={colCount} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhum pagamento de empréstimo encontrado no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-blue-50/60 hover:bg-blue-50/60">
                            <TableCell colSpan={colCount} className="py-1 px-4">
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
                              <TableCell colSpan={colCount} className="py-1 px-4">
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
                          <TableCell colSpan={colCount} className="py-2 px-4">
                            <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3">
                              Nenhum empréstimo encontrado no período.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <TableRow className="bg-red-50/60 hover:bg-red-50/60">
                            <TableCell colSpan={colCount} className="py-1 px-4">
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
                              <TableCell colSpan={colCount} className="py-1 px-4">
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
