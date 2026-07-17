'use client';

import { RelatorioDreBase } from '@/components/RelatorioDreBase';

/**
 * DRE por Status. Reusa 100% do corpo do Relatório DRE ({@link RelatorioDreBase})
 * — mesmos componentes, actions e exports — habilitando apenas o filtro opcional
 * por status do projeto. Zero lógica de cálculo/export duplicada.
 */
export function RelatorioDrePorStatus() {
  return (
    <RelatorioDreBase
      showStatusFilter
      titulo="DRE por Status"
      descricao="Demonstrativo de resultado com rateio das contas por status do projeto (Em andamento / Concluído). Sem status selecionado, o resultado é idêntico ao Relatório DRE."
    />
  );
}
