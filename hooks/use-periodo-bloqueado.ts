import { supabase } from '@/integrations/supabase/client';

interface ValidacaoPeriodoParams {
  matrizId?: number;
  dataCompetencia?: Date | string;
  dataPagamento?: Date | string;
}

interface ValidacaoResult {
  bloqueado: boolean;
  mensagem: string;
}

function getMonthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}-01`;
}

function formatMonthLabel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${year}`;
}

export async function validarPeriodoBloqueado(
  params: ValidacaoPeriodoParams
): Promise<ValidacaoResult> {
  const { matrizId, dataCompetencia, dataPagamento } = params;

  // Check competência blocking
  if (dataCompetencia) {
    const mesRef = getMonthKey(dataCompetencia);
    const resultado = await verificarBloqueio(mesRef, matrizId, 'competencia');
    if (resultado.bloqueado) {
      return {
        bloqueado: true,
        mensagem: `Não é possível realizar este lançamento, pois o mês de competência ${formatMonthLabel(dataCompetencia)} está bloqueado.`,
      };
    }
  }

  // Check pagamento blocking
  if (dataPagamento) {
    const mesRef = getMonthKey(dataPagamento);
    const resultado = await verificarBloqueio(mesRef, matrizId, 'pagamento');
    if (resultado.bloqueado) {
      return {
        bloqueado: true,
        mensagem: `Não é possível concluir esta operação, pois o mês de pagamento ${formatMonthLabel(dataPagamento)} está bloqueado.`,
      };
    }
  }

  return { bloqueado: false, mensagem: '' };
}

async function verificarBloqueio(
  mesRef: string,
  matrizId: number | undefined,
  tipo: 'competencia' | 'pagamento'
): Promise<{ bloqueado: boolean }> {
  const coluna = tipo === 'competencia' ? 'bloqueia_competencia' : 'bloqueia_pagamento';

  // Get all active blocks for this month
  const { data: bloqueios, error } = await supabase
    .from('periodos_bloqueados' as any)
    .select('id, aplica_todas_matrizes')
    .eq('referencia_mes', mesRef)
    .eq('status', 'ativo')
    .eq(coluna, true);

  if (error || !bloqueios || bloqueios.length === 0) {
    return { bloqueado: false };
  }

  for (const bloqueio of bloqueios as any[]) {
    // If applies to all matrices, it's blocked
    if (bloqueio.aplica_todas_matrizes) {
      return { bloqueado: true };
    }

    // If no matrizId provided, check if any block exists
    if (!matrizId) {
      return { bloqueado: true };
    }

    // Check if this specific matrix is in the block
    const { data: vinculos } = await supabase
      .from('periodos_bloqueados_matrizes' as any)
      .select('id')
      .eq('periodo_bloqueado_id', bloqueio.id)
      .eq('matriz_id', matrizId);

    if (vinculos && vinculos.length > 0) {
      return { bloqueado: true };
    }
  }

  return { bloqueado: false };
}
