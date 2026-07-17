'use client';

import { RelatorioDreBase } from '@/components/RelatorioDreBase';

/**
 * Relatório DRE (tela original). Wrapper fino sobre {@link RelatorioDreBase} sem
 * o filtro de status — comportamento e layout idênticos ao de antes da extração.
 * A tela "DRE por Status" reusa o mesmo corpo com `showStatusFilter`.
 */
export function RelatorioDre() {
  return <RelatorioDreBase />;
}
