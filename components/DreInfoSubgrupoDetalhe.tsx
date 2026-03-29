'use client';

import React from 'react';
import { useLoadAction } from '@uibakery/data';
import { TableCell, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import loadDreInfoDetalheContasPagarAction from '@/actions/loadDreInfoDetalheContasPagar';
import loadDreInfoDetalheContasReceberAction from '@/actions/loadDreInfoDetalheContasReceber';

interface DreInfoSubgrupoDetalheProps {
  matrizId: number;
  subgrupoId: number;
  tipoData: 'competencia' | 'pagamento';
  dataInicio: string;
  dataFim: string;
  projetoId?: number | null;
  funcao?: string;
  nivel: number;
}

interface DetalheItem {
  id: number;
  favorecido: string;
  observacao: string;
  data_referencia: string;
  valor: number;
  projetos: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function DreInfoSubgrupoDetalhe({
  matrizId,
  subgrupoId,
  tipoData,
  dataInicio,
  dataFim,
  projetoId,
  funcao,
  nivel,
}: DreInfoSubgrupoDetalheProps) {
  const { formatCurrency } = useCurrency();

  const [cpDetalhe, loadingCp] = useLoadAction(
    loadDreInfoDetalheContasPagarAction,
    [],
    { matrizId, subgrupoId, tipoData, dataInicio, dataFim, projetoId }
  );

  const [crDetalhe, loadingCr] = useLoadAction(
    loadDreInfoDetalheContasReceberAction,
    [],
    { matrizId, subgrupoId, tipoData, dataInicio, dataFim, projetoId }
  );

  const isLoading = loadingCp || loadingCr;

  const allItems: DetalheItem[] = React.useMemo(() => {
    const cpItems = (cpDetalhe || []).map((d: any) => ({
      id: d.id,
      favorecido: d.favorecido || '-',
      observacao: d.observacao || '',
      data_referencia: d.data_referencia || '',
      valor: Number(d.valor) || 0,
      projetos: d.projetos || '',
    }));

    const crItems = (crDetalhe || []).map((d: any) => ({
      id: `cr_${d.id}`,
      favorecido: d.favorecido || '-',
      observacao: d.observacao || '',
      data_referencia: d.data_referencia || '',
      valor: Number(d.valor) || 0,
      projetos: d.projetos || '',
    }));

    const combined = [...cpItems, ...crItems] as DetalheItem[];
    return combined.sort((a, b) => {
      if (a.data_referencia < b.data_referencia) return -1;
      if (a.data_referencia > b.data_referencia) return 1;
      return 0;
    });
  }, [cpDetalhe, crDetalhe]);

  const isDebito = funcao === 'Débito' || funcao === 'DEBITO';

  if (isLoading) {
    return (
      <TableRow className="bg-slate-50/60">
        <TableCell colSpan={3} className="py-2 px-4">
          <div className="flex items-center gap-2 ml-8 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando lançamentos...
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (allItems.length === 0) {
    return (
      <TableRow className="bg-slate-50/60">
        <TableCell colSpan={3} className="py-2 px-4">
          <div className="ml-8 text-sm text-muted-foreground italic border-l-2 border-slate-200 pl-3 py-1">
            Nenhum lançamento encontrado para este subgrupo no período.
          </div>
        </TableCell>
      </TableRow>
    );
  }

  const indentPx = (nivel) * 24;

  return (
    <>
      {/* Sub-header row */}
      <TableRow className="bg-blue-50/60 hover:bg-blue-50/60">
        <TableCell colSpan={3} className="py-1 px-4">
          <div
            className="grid text-xs font-semibold text-slate-500 border-l-2 border-blue-300 pl-3"
            style={{ marginLeft: `${indentPx}px`, gridTemplateColumns: '110px 1fr 1fr 120px' }}
          >
            <span>Data</span>
            <span>Favorecido</span>
            <span>Observação</span>
            <span className="text-right">Valor</span>
          </div>
        </TableCell>
      </TableRow>

      {/* Detail rows */}
      {allItems.map((item, index) => (
        <TableRow
          key={`${item.id}_${index}`}
          className="bg-slate-50/40 hover:bg-blue-50/30 border-b border-slate-100"
        >
          <TableCell colSpan={3} className="py-1 px-4">
            <div
              className="grid text-xs items-center border-l-2 border-blue-100 pl-3"
              style={{ marginLeft: `${indentPx}px`, gridTemplateColumns: '110px 1fr 1fr 120px' }}
            >
              <span className="text-muted-foreground font-mono">
                {formatDate(item.data_referencia)}
              </span>
              <span className="font-medium text-slate-700 truncate pr-2">
                {item.favorecido}
              </span>
              <span className="text-muted-foreground truncate pr-2">
                {item.observacao || <em className="opacity-50">—</em>}
              </span>
              <span
                className={`text-right font-mono font-medium ${
                  isDebito ? 'text-red-600' : 'text-green-700'
                }`}
              >
                {formatCurrency(item.valor)}
              </span>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
