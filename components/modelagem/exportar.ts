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

  // Os valores unitários vêm marcados "(un)" e os totais ao lado, calculados pelo
  // motor: somar coluna unitária de tipologias diferentes não significa nada, e o
  // subtotal existe justamente para ninguém tentar.
  const linhasUnidades = input.unidades.map((u, i) => {
    const r = resultado.resultadoUnidades[i];
    const n = Math.max(1, Math.trunc(u.quantidade || 1));
    return [
      u.nome,
      u.cidade ?? '',
      n,
      u.areaSf ?? 0,
      u.custoTerreno,
      u.custoObra,
      u.precoVenda,
      u.propertyTaxAno,
      (u.areaSf ?? 0) * n,
      u.custoTerreno * n,
      u.custoObra * n,
      u.precoVenda * n,
      r?.custoTotal ?? 0,
      r?.custoTotalUnitario ?? 0,
      r?.lucro ?? 0,
      r?.margem ?? 0,
    ];
  });
  const somaColuna = (c: number) => linhasUnidades.reduce((a, l) => a + (Number(l[c]) || 0), 0);
  const unidades = [
    [
      'Tipologia', 'Cidade', 'Qtd', 'Area sf (un)', 'Terreno (un)', 'Obra (un)', 'Preco de venda (un)',
      'Tax/ano (un)', 'Area total', 'Terreno total', 'Obra total', 'VGV total', 'Custo total',
      'Custo unitario', 'Lucro', 'Margem',
    ],
    ...linhasUnidades,
    [
      `Totais (${input.unidades.length} tipologias)`, '', resultado.agregados.unidadesTotal,
      '', '', '', '', '',
      somaColuna(8), resultado.agregados.terrenosTotal, resultado.agregados.obraTotal,
      resultado.agregados.vgv, somaColuna(12), '', somaColuna(14), '',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unidades), 'Unidades');

  // Aba Aportes: o plano lado a lado com o que o motor efetivamente chamou.
  const parcelaPorMes = new Map<number, number>();
  for (const p of input.aportes?.parcelas ?? []) {
    parcelaPorMes.set(p.mes, (parcelaPorMes.get(p.mes) ?? 0) + (p.valor || 0));
  }
  let acumuladoPlano = 0;
  const aportes: (string | number)[][] = [
    ['Modo', input.aportes?.modoAporte ?? 'demanda'],
    ['Aporte base total', input.aportes?.aporteBaseTotal ?? 0],
    ['Valor total alvo', input.aportes?.valorTotalAlvo ?? 0],
    ['Planejado (soma das parcelas)', resultado.agregados.aportePlanejadoTotal],
    ['Chamado no fluxo', ap.equityTotal],
    [],
    ['Mes', 'Data', 'Parcela do plano', 'Acumulado do plano', 'Chamado no fluxo', 'Acumulado no fluxo'],
  ];
  for (const m of resultado.meses) {
    const parcela = parcelaPorMes.get(m.mes) ?? 0;
    acumuladoPlano += parcela;
    aportes.push([m.mes, m.data, parcela, acumuladoPlano, m.equityCall, m.equityAcumulado]);
  }
  // Parcelas além do prazo não aparecem no fluxo, mas existem no plano — some-las
  // em silêncio esconderia justamente o que a conferência acusa.
  for (const p of input.aportes?.parcelas ?? []) {
    if (p.mes > resultado.cronograma.prazoTotal) {
      aportes.push([p.mes, 'fora do prazo', p.valor, '', '', '']);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aportes), 'Aportes');

  // Aba Fases: janela de cada fase e a distribuição de unidades por tipologia.
  const fases = input.fases ?? [];
  const alocado = (unidadeIndex: number, faseIndex: number) =>
    (input.alocacoes ?? [])
      .filter((a) => a.unidadeIndex === unidadeIndex && a.faseIndex === faseIndex)
      .reduce((a, x) => a + (x.quantidade || 0), 0);
  const abaFases: (string | number)[][] = [
    ['Usa fases', input.usaFases ? 'sim' : 'nao'],
    ['Terreno por fase', input.terrenoPorFase ? 'sim' : 'nao'],
    [],
    ['Fase', 'Data inicio', 'Data fim', 'Mes inicio', 'Mes fim', 'Duracao (meses)', ...input.unidades.map((u) => u.nome || 'Tipologia')],
    ...fases.map((f, j) => {
      const d = resultado.cronograma.fases[j];
      return [
        f.nome,
        f.dataInicio,
        f.dataFim,
        d?.mesInicio ?? '',
        d?.mesFim ?? '',
        d ? d.mesFim - d.mesInicio + 1 : '',
        ...input.unidades.map((_u, i) => alocado(i, j)),
      ];
    }),
    [
      'Alocado', '', '', '', '', '',
      ...input.unidades.map((_u, i) => fases.reduce((a, _f, j) => a + alocado(i, j), 0)),
    ],
    ['Quantidade da tipologia', '', '', '', '', '', ...input.unidades.map((u) => Math.max(1, Math.trunc(u.quantidade || 1)))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaFases), 'Fases');

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
