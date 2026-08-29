/**
 * Exportação da modelagem.
 *
 * Tudo aqui lê o `ModelOutput` — nenhum número é recalculado. Se a planilha
 * divergir da tela, é bug de leitura, não de cálculo.
 */
import * as XLSX from 'xlsx';
import type { ModelInput, ModelOutput } from '@/lib/modelagem';

const nomeArquivo = (input: ModelInput, extensao: string) =>
  `${(input.nome || 'modelagem').replace(/[^\w\-]+/g, '_').toLowerCase()}.${extensao}`;

/** Ordem das linhas do fluxo — a mesma da tela, de propósito. */
function linhasDoFluxo(resultado: ModelOutput) {
  const m = resultado.meses;
  return [
    ['Terrenos', m.map((x) => x.land)],
    ['Obra', m.map((x) => x.construction)],
    ['Property taxes', m.map((x) => x.propertyTax)],
    ['Outros custos', m.map((x) => x.otherCosts)],
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

export function exportarXlsx(input: ModelInput, resultado: ModelOutput) {
  const wb = XLSX.utils.book_new();
  const ap = resultado.apuracao;
  const ind = resultado.indicadores;

  const premissas = [
    ['Modelagem', input.nome ?? ''],
    ['Localizacao', input.localizacao ?? ''],
    ['Moeda', input.moeda ?? 'USD'],
    ['Data do mes 1', input.dataInicio],
    ['Meses de aprovacao', input.mesesAprovacao],
    ['Meses de construcao', input.mesesConstrucao],
    ['Meses de pos-obra', input.mesesPosObra],
    ['Prazo total', resultado.cronograma.prazoTotal],
    ['Mes de saida', resultado.cronograma.mesSaida],
    ['Taxa ao ano', input.financiamento.taxaAnual],
    ['Fee de estruturacao', input.financiamento.feeEstruturacaoPct],
    ['Modo de saque', input.financiamento.modoSaque],
    ['Modo de amortizacao', input.financiamento.modoAmortizacao],
    ['Comissao', input.receita.comissaoPct],
    ['Cartorio', input.receita.custoCartorioPct],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(premissas), 'Premissas');

  const unidades = [
    ['Nome', 'Cidade', 'Area sf', 'Terreno', 'Obra', 'Aporte base', 'Preco de venda', 'Tax/ano', 'Custo total', 'Lucro', 'Margem'],
    ...input.unidades.map((u, i) => {
      const r = resultado.resultadoUnidades[i];
      return [u.nome, u.cidade ?? '', u.areaSf ?? 0, u.custoTerreno, u.custoObra, u.aporteBase, u.precoVenda, u.propertyTaxAno, r?.custoTotal ?? 0, r?.lucro ?? 0, r?.margem ?? 0];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unidades), 'Unidades');

  const cabecalho = ['Linha', ...resultado.meses.map((m) => `M${m.mes} ${m.data}`), 'Total'];
  const fluxo = [
    cabecalho,
    ...linhasDoFluxo(resultado).map(([rotulo, valores]) => [rotulo, ...valores, valores.reduce((a, b) => a + b, 0)]),
  ];
  const abaFluxo = XLSX.utils.aoa_to_sheet(fluxo);
  // Coluna de total como SOMA de verdade: quem abrir a planilha consegue auditar
  // a linha inteira sem confiar no número exportado.
  const ultimaColuna = resultado.meses.length + 1;
  for (let l = 1; l < fluxo.length; l++) {
    const ref = XLSX.utils.encode_cell({ r: l, c: ultimaColuna });
    const de = XLSX.utils.encode_cell({ r: l, c: 1 });
    const ate = XLSX.utils.encode_cell({ r: l, c: ultimaColuna - 1 });
    abaFluxo[ref] = { t: 'n', v: (fluxo[l][ultimaColuna] as number) ?? 0, f: `SUM(${de}:${ate})` };
  }
  XLSX.utils.book_append_sheet(wb, abaFluxo, 'Fluxo de caixa');

  const resultadoAba = [
    ['Receita bruta (VGV)', ap.receitaBruta],
    ['Comissoes', -ap.comissoes],
    ['Cartorio', -ap.cartorio],
    ['Receita liquida', ap.receitaLiquida],
    ['Terrenos', -ap.custoTerrenos],
    ['Obra', -ap.custoObra],
    ['Property taxes', -ap.custoPropertyTax],
    ['Outros custos', -ap.custoOutros],
    ['Custo do empreendimento', -ap.custoEmpreendimento],
    ['Juros', -ap.jurosTotais],
    ['Fee de estruturacao', -ap.feeTotal],
    ['Custo financeiro', -ap.custoFinanceiro],
    ['Lucro do projeto', ap.lucroProjeto],
    ['Lucro dos investidores', ap.lucroInvestidores],
    ['Lucro do sponsor', ap.lucroSponsor],
    [],
    ['Equity total', ap.equityTotal],
    ['Divida sacada', ap.dividaSacada],
    ['Divida amortizada', ap.dividaAmortizada],
    ['Total distribuido', ap.totalDistribuido],
    [],
    ['MOIC', ind.moic ?? 'n/d'],
    ['ROI', ind.roi ?? 'n/d'],
    ['Margem sobre VGV', ind.margemVgv ?? 'n/d'],
    ['LTC', ind.ltc ?? 'n/d'],
    ['TIR mensal', ind.tirMensal ?? 'n/d'],
    ['TIR anual', ind.tirAnual ?? 'n/d'],
    ['XIRR', ind.xirr ?? 'n/d'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resultadoAba), 'Resultado');

  const socios = [
    ['Socio', 'Participacao', 'Capital', 'Lucro', 'Total'],
    ...resultado.rateioSocios.map((s) => [s.nome, s.participacaoPct, s.capital, s.lucro, s.total]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(socios), 'Socios');

  const conferencias = [
    ['Conferencia', 'Semaforo', 'Valor', 'Detalhe'],
    ...resultado.conferencias.map((c) => [c.titulo, c.semaforo, c.valor, c.detalhe]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(conferencias), 'Conferencias');

  XLSX.writeFile(wb, nomeArquivo(input, 'xlsx'));
}
