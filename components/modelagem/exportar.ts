/**
 * Exportação da modelagem.
 *
 * Tudo aqui lê o `ModelOutput` — nenhum número é recalculado. Se a planilha
 * divergir da tela, é bug de leitura, não de cálculo.
 *
 * Este arquivo guarda só o CSV, que é o caminho simples e sem dependência. O
 * relatório PDF vive em `exportarPdf.ts` e a planilha formatada em
 * `exportarXlsx.ts` — ambos com import pesado, ambos assíncronos ou lentos o
 * bastante para merecerem arquivo próprio.
 */
import type { ModelInput, ModelOutput } from '@/lib/modelagem';

export { exportarModelagemPdf, nomeArquivoModelagem } from './exportarPdf';
export { exportarXlsx } from './exportarXlsx';

const nomeArquivo = (input: ModelInput, extensao: string) =>
  `${(input.nome || 'modelagem').replace(/[^\w\-]+/g, '_').toLowerCase()}.${extensao}`;

/**
 * Ordem das linhas do fluxo — a mesma da tela, de propósito.
 *
 * O terceiro elemento é `somavel`, e espelha a constante LINHAS de
 * AbaFluxoCaixa.tsx: FALSE nas linhas de ESTOQUE (saldo devedor, equity
 * acumulado, caixa acumulado). Somar um estoque mês a mês não significa nada —
 * o "total" de Caixa acumulado é a soma de saldos que já se contêm uns aos
 * outros, e o número que saía daí (−$57.471.511 no caso que motivou esta
 * correção) não é grandeza nenhuma. A tela e a planilha já não somavam essas
 * três; só o CSV somava.
 */
function linhasDoFluxo(resultado: ModelOutput) {
  const m = resultado.meses;
  return [
    ['Terrenos', m.map((x) => x.land), true],
    ['Obra', m.map((x) => x.construction), true],
    ['Property taxes', m.map((x) => x.propertyTax), true],
    // Rótulo idêntico ao da grade. O CSV leva o total do mês, sem as filhas.
    ['Custos', m.map((x) => x.otherCosts), true],
    ['Juros e taxas', m.map((x) => x.custoFinanceiroCaixa), true],
    ['Total de pagamentos', m.map((x) => x.pagamentos), true],
    ['Receita', m.map((x) => x.revenue), true],
    ['Saque', m.map((x) => x.draw), true],
    ['Amortizacao', m.map((x) => x.amortization), true],
    ['Aporte de equity', m.map((x) => x.equityCall), true],
    ['Distribuicao', m.map((x) => x.distribution), true],
    ['Saldo devedor', m.map((x) => x.saldoDevedor), false],
    ['Equity acumulado', m.map((x) => x.equityAcumulado), false],
    ['Caixa do mes', m.map((x) => x.caixaMes), true],
    ['Caixa acumulado', m.map((x) => x.caixaAcumulado), false],
  ] as [string, number[], boolean][];
}

function baixar(conteudo: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportarFluxoCsv(input: ModelInput, resultado: ModelOutput) {
  const cabecalho = ['Linha', ...resultado.meses.map((m) => `${m.mes} (${m.data})`), 'Total'];
  const corpo = linhasDoFluxo(resultado).map(([rotulo, valores, somavel]) => [
    rotulo,
    ...valores.map((v) => v.toFixed(2)),
    // Estoque não soma: a coluna Total fica VAZIA, e não zero — zero seria um
    // número, e um número ali é lido como resultado.
    somavel ? valores.reduce((a, b) => a + b, 0).toFixed(2) : '',
  ]);
  // Aspas em tudo: os rótulos podem conter vírgula e o Excel BR usa ; como
  // separador — o padrão aqui é vírgula, consistente com os demais exports.
  const csv = [cabecalho, ...corpo].map((l) => l.map((c) => `"${c}"`).join(',')).join('\n');
  baixar('﻿' + csv, nomeArquivo(input, 'csv'), 'text/csv;charset=utf-8');
}
