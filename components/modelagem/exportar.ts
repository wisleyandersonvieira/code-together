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

/** Ordem das linhas do fluxo — a mesma da tela, de propósito. */
function linhasDoFluxo(resultado: ModelOutput) {
  const m = resultado.meses;
  return [
    ['Terrenos', m.map((x) => x.land)],
    ['Obra', m.map((x) => x.construction)],
    ['Property taxes', m.map((x) => x.propertyTax)],
    // Rótulo idêntico ao da grade. O CSV leva o total do mês, sem as filhas.
    ['Custos', m.map((x) => x.otherCosts)],
    ['Juros e taxas', m.map((x) => x.custoFinanceiroCaixa)],
    ['Total de pagamentos', m.map((x) => x.pagamentos)],
    ['Receita', m.map((x) => x.revenue)],
    ['Saque', m.map((x) => x.draw)],
    ['Amortizacao', m.map((x) => x.amortization)],
    ['Aporte de equity', m.map((x) => x.equityCall)],
    ['Distribuicao', m.map((x) => x.distribution)],
    ['Saldo devedor', m.map((x) => x.saldoDevedor)],
    ['Equity acumulado', m.map((x) => x.equityAcumulado)],
    ['Caixa do mes', m.map((x) => x.caixaMes)],
    ['Caixa acumulado', m.map((x) => x.caixaAcumulado)],
  ] as [string, number[]][];
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
  const corpo = linhasDoFluxo(resultado).map(([rotulo, valores]) => [
    rotulo,
    ...valores.map((v) => v.toFixed(2)),
    valores.reduce((a, b) => a + b, 0).toFixed(2),
  ]);
  // Aspas em tudo: os rótulos podem conter vírgula e o Excel BR usa ; como
  // separador — o padrão aqui é vírgula, consistente com os demais exports.
  const csv = [cabecalho, ...corpo].map((l) => l.map((c) => `"${c}"`).join(',')).join('\n');
  baixar('﻿' + csv, nomeArquivo(input, 'csv'), 'text/csv;charset=utf-8');
}
