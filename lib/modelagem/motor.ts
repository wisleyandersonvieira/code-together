/**
 * Motor de modelagem financeira de incorporação.
 *
 * Determinístico e auditável: mesmos inputs → mesmo output, sem exceção por
 * input inconsistente (o que não fecha vira conferência, não erro).
 *
 * ── Estrutura de passes ──────────────────────────────────────────────────────
 * Três grandezas só são conhecidas depois que o loop mensal termina, e todas as
 * três realimentam o próprio loop:
 *
 *   1. o fee de estruturação depende do TOTAL sacado;
 *   2. no modo cash_demand o saque depende do caixa, que depende do custo
 *      financeiro, que depende do saque;
 *   3. a distribuição automática depende do equity total, e uma distribuição
 *      lançada antes do fim muda o caixa de abertura dos meses seguintes, que
 *      muda o equity.
 *
 * Por isso o loop roda dentro de um ponto fixo: cada passada usa as estimativas
 * da passada anterior e para quando nada mais se move além de TOL_CONVERGENCIA.
 * No modo equity_first sem capitalização isso converge em 3 passadas.
 */
import type {
  Agregados,
  Apuracao,
  Conferencia,
  Cronograma,
  Indicadores,
  LinhaFluxo,
  MesFluxo,
  ModelInput,
  ModelOutput,
  Override,
  RateioSocio,
  ResultadoUnidade,
  Unidade,
} from './tipos';
import { montarConferencias } from './conferencias';
import { anualizar, razao, somarMeses, tirMensal, xirr } from './indicadores';

const MAX_ITERACOES = 50;
const TOL_CONVERGENCIA = 0.01;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const chave = (mes: number, linha: LinhaFluxo) => `${mes}:${linha}`;

interface EstadoPonto {
  feeTotal: number;
  /** Custo financeiro de caixa por mês, indexado de 1 a prazoTotal. */
  custoFinPorMes: number[];
  distribuicaoAutomatica: number;
}

export function calcular(input: ModelInput): ModelOutput {
  const fin = input.financiamento;
  const rec = input.receita;
  const unidades = input.unidades ?? [];
  const custosAdicionais = input.custosAdicionais ?? [];
  const socios = input.socios ?? [];

  // ─── Cronograma ────────────────────────────────────────────────────────────
  const prazoTotal = Math.max(
    0,
    Math.trunc(input.mesesAprovacao) +
      Math.trunc(input.mesesConstrucao) +
      Math.trunc(input.mesesPosObra),
  );
  const mesInicioObra = Math.trunc(input.mesesAprovacao) + 1;
  const mesFimObra = Math.trunc(input.mesesAprovacao) + Math.trunc(input.mesesConstrucao);
  const mesSaida = rec.mesSaida ?? prazoTotal;
  const horizonteMaximo = input.horizonteMaximo ?? 60;

  const cronograma: Cronograma = {
    prazoTotal,
    mesInicioObra,
    mesFimObra,
    mesSaida,
    horizonteMaximo,
    dataInicio: input.dataInicio,
    dataInicioObra: somarMeses(input.dataInicio, mesInicioObra - 1),
    dataFimObra: somarMeses(input.dataInicio, Math.max(mesFimObra, 1) - 1),
    dataSaida: somarMeses(input.dataInicio, Math.max(mesSaida, 1) - 1),
  };

  // ─── Agregados das tipologias ──────────────────────────────────────────────
  // Cada linha de `unidades` é uma TIPOLOGIA e seus valores são POR UNIDADE, então
  // todo agregado multiplica por quantidade. Com quantidade = 1 (o default da
  // migration 1761000000) a multiplicação é a identidade e nada muda.
  const qtd = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));
  const terrenosTotal = soma(unidades.map((u) => (u.custoTerreno || 0) * qtd(u)));
  const obraTotal = soma(unidades.map((u) => (u.custoObra || 0) * qtd(u)));
  const vgv = soma(unidades.map((u) => (u.precoVenda || 0) * qtd(u)));
  const taxAnoTotal = soma(unidades.map((u) => (u.propertyTaxAno || 0) * qtd(u)));
  const unidadesTotal = soma(unidades.map(qtd));
  const propertyTaxTotal = (taxAnoTotal / 12) * prazoTotal;
  // O aporte base deixou de ser atributo da unidade e passou a ser premissa do
  // projeto (tabela modelagem_aportes). A derivação é a mesma de antes, sobre a
  // mesma grandeza: a migration semeia aporte_base_total com a soma que este
  // ponto calculava. max(0, …): se o aporte base não cobre nem o terreno, o valor
  // tem de ficar em zero — senão a dívida do modo equity_first começa maior que a
  // obra acumulada.
  const aporteBaseTotal = input.aportes?.aporteBaseTotal ?? 0;
  const equityDisponivelObra = Math.max(0, aporteBaseTotal - terrenosTotal);

  const agregados: Agregados = {
    terrenosTotal,
    obraTotal,
    unidadesTotal,
    vgv,
    taxAnoTotal,
    propertyTaxTotal,
    equityDisponivelObra,
  };

  // ─── Overrides ─────────────────────────────────────────────────────────────
  // Overrides fora do prazo NÃO são apagados: ficam inativos, acendem conferência
  // e voltam a valer se o prazo aumentar de novo.
  const ativos = new Map<string, number | null>();
  const orfaos: Override[] = [];
  for (const o of input.overrides ?? []) {
    if (!Number.isInteger(o.mes) || o.mes < 1 || o.mes > prazoTotal) {
      orfaos.push(o);
      continue;
    }
    ativos.set(chave(o.mes, o.linha), o.limpar ? null : (o.valor ?? 0));
  }
  const temOverride = (m: number, l: LinhaFluxo) => ativos.has(chave(m, l));
  // `null` (célula forçada a vazio) não contribui com nada na aritmética, mas
  // continua distinta de zero para a interface.
  const valorOverride = (m: number, l: LinhaFluxo) => ativos.get(chave(m, l)) ?? 0;

  // ─── Linhas de custo e receita (não dependem da iteração) ──────────────────
  const zeros = () => new Array<number>(prazoTotal + 1).fill(0);
  const land = zeros();
  const construction = zeros();
  const propertyTax = zeros();
  const otherCosts = zeros();
  const revenue = zeros();

  const mesesConstrucao = Math.trunc(input.mesesConstrucao);
  const fatorLiquido = 1 - (rec.comissaoPct || 0) - (rec.custoCartorioPct || 0);

  for (let m = 1; m <= prazoTotal; m++) {
    land[m] = m === 1 ? terrenosTotal : 0;
    construction[m] =
      mesesConstrucao > 0 && m >= mesInicioObra && m <= mesFimObra ? obraTotal / mesesConstrucao : 0;
    propertyTax[m] = taxAnoTotal / 12;

    let outros = 0;
    for (const c of custosAdicionais) {
      const valor = c.valor || 0;
      if (c.distribuicao === 'linear_construction') {
        if (mesesConstrucao > 0 && m >= mesInicioObra && m <= mesFimObra) outros += valor / mesesConstrucao;
      } else if (c.distribuicao === 'linear_total') {
        if (prazoTotal > 0) outros += valor / prazoTotal;
      } else if (c.distribuicao === 'single_month') {
        if (c.mesAncora === m) outros += valor;
      }
      // 'manual' → só overrides.
    }
    otherCosts[m] = outros;
  }

  if (rec.modoVenda === 'single_exit') {
    if (mesSaida >= 1 && mesSaida <= prazoTotal) revenue[mesSaida] = vgv * fatorLiquido;
  } else if (rec.modoVenda === 'per_unit') {
    for (const venda of rec.vendasPorUnidade ?? []) {
      const u = unidades[venda.unidadeIndex];
      if (!u) continue;
      if (venda.mesVenda >= 1 && venda.mesVenda <= prazoTotal) {
        // A tipologia inteira vende no mesmo mês: venda escalonada dentro de uma
        // tipologia (parte das N unidades num mês, o resto em outro) NÃO é
        // suportada nesta versão. Quem precisar disso separa em duas linhas.
        revenue[venda.mesVenda] += (u.precoVenda || 0) * qtd(u) * fatorLiquido;
      }
    }
  }
  // 'manual' → só overrides.

  for (let m = 1; m <= prazoTotal; m++) {
    if (temOverride(m, 'land')) land[m] = valorOverride(m, 'land');
    if (temOverride(m, 'construction')) construction[m] = valorOverride(m, 'construction');
    if (temOverride(m, 'property_tax')) propertyTax[m] = valorOverride(m, 'property_tax');
    if (temOverride(m, 'other_costs')) otherCosts[m] = valorOverride(m, 'other_costs');
    if (temOverride(m, 'revenue')) revenue[m] = valorOverride(m, 'revenue');
  }

  // ─── Teto de dívida ────────────────────────────────────────────────────────
  const tetoDivida =
    fin.valorContratado != null
      ? fin.valorContratado
      : fin.maxLtcPct != null
        ? fin.maxLtcPct * (terrenosTotal + obraTotal)
        : Number.POSITIVE_INFINITY;

  const taxaMensal = (fin.taxaAnual || 0) / 12;
  const colchao = fin.colchaoMinimoCaixa || 0;

  // ─── Uma passada do loop mensal ────────────────────────────────────────────
  const passe = (estado: EstadoPonto): MesFluxo[] => {
    const meses: MesFluxo[] = [];
    let saldoAnterior = 0;
    let caixaAcumulado = 0;
    let obraAcumulada = 0;
    let sacadoAte = 0;
    let equityAcumulado = 0;
    let jaHouveSaque = false;

    for (let m = 1; m <= prazoTotal; m++) {
      const pagamentosOperacionais = land[m] + construction[m] + propertyTax[m] + otherCosts[m];
      const saldoAbertura = saldoAnterior;
      const caixaAbertura = caixaAcumulado;
      obraAcumulada += construction[m];

      const capacidade = Math.max(0, tetoDivida - sacadoAte);
      const dentroJanela = m >= fin.mesInicioSaque && m <= fin.mesFimSaque;

      // 1. SAQUE — vem antes da amortização, porque no modo at_exit a amortização
      //    precisa conhecer o saque do próprio mês. Para não fechar o círculo no
      //    cash_demand, o saque usa uma amortização PREVISTA (só o saldo de
      //    abertura), não a definitiva.
      const amortPrevista =
        fin.modoAmortizacao === 'at_exit' && m === mesSaida ? saldoAbertura : 0;

      let draw: number;
      if (temOverride(m, 'draw')) {
        // Override de saque vence sempre, inclusive acima do teto: nesse caso a
        // conferência acende vermelho, mas o cálculo segue.
        draw = valorOverride(m, 'draw');
      } else if (fin.modoSaque === 'equity_first') {
        // Regra clássica: o capital próprio entra primeiro na obra. Só há saque
        // depois que a obra acumulada ultrapassa o equity disponível para obra.
        draw = dentroJanela
          ? clamp(obraAcumulada - equityDisponivelObra, 0, Math.min(construction[m], capacidade))
          : 0;
      } else if (fin.modoSaque === 'cash_demand') {
        // Dimensiona a dívida pela necessidade real de caixa do mês.
        const custoFinEstimado = fin.custoFinanceiroNaDemanda ? (estado.custoFinPorMes[m] ?? 0) : 0;
        const demanda =
          pagamentosOperacionais + custoFinEstimado + amortPrevista + colchao - revenue[m] - caixaAbertura;
        draw = dentroJanela ? clamp(demanda, 0, capacidade) : 0;
      } else {
        draw = 0; // 'manual' → só overrides
      }
      sacadoAte += draw;

      // 2. JUROS — dependem só do saldo já sacado, então já podem ser apurados.
      const saldoAntes = saldoAbertura + draw;
      const juros = saldoAntes * taxaMensal;
      // Com capitalização, os juros viram principal ANTES da amortização; senão
      // o saldo final do mês de saída ficaria com um mês de juros pendurado.
      const baseAmortizavel = saldoAntes + (fin.capitalizarJuros ? juros : 0);

      // 3. AMORTIZAÇÃO — o clamp impede saldo devedor negativo mesmo com override abusivo.
      let alvoAmort: number;
      if (temOverride(m, 'amortization')) alvoAmort = valorOverride(m, 'amortization');
      else if (fin.modoAmortizacao === 'at_exit') alvoAmort = m === mesSaida ? baseAmortizavel : 0;
      else alvoAmort = 0;
      const amortization = clamp(alvoAmort, 0, baseAmortizavel);
      const saldoDevedor = baseAmortizavel - amortization;

      // 4. FEE
      const ehPrimeiroSaque = !jaHouveSaque && draw > 0;
      if (ehPrimeiroSaque) jaHouveSaque = true;
      const mesDoFee =
        fin.feeTiming === 'first_draw' ? ehPrimeiroSaque : m === fin.feeMes;
      const fee = mesDoFee ? estado.feeTotal : 0;

      // Juros capitalizados não saem do caixa (viram principal), mas continuam
      // na apuração de resultado como custo financeiro incorrido.
      const custoFinanceiroCaixa = (fin.capitalizarJuros ? 0 : juros) + fee;
      const pagamentos = pagamentosOperacionais + custoFinanceiroCaixa;

      // 5. APORTE DE EQUITY — a receita do mês cobre os custos do próprio mês.
      //    No mês da venda isso significa que não há chamada de capital para
      //    pagar juros e property tax daquele mês: o dinheiro da venda já entrou.
      let equityCall: number;
      if (temOverride(m, 'equity_call')) {
        equityCall = valorOverride(m, 'equity_call');
      } else {
        equityCall = Math.max(
          0,
          pagamentos + amortization + colchao - draw - revenue[m] - caixaAbertura,
        );
      }
      equityAcumulado += equityCall;

      // 6. DISTRIBUIÇÃO
      const distribution = temOverride(m, 'distribution')
        ? valorOverride(m, 'distribution')
        : m === mesSaida
          ? estado.distribuicaoAutomatica
          : 0;

      // 7. CAIXA — com override de equity_call o caixa absorve a diferença,
      //    inclusive ficando negativo (a conferência acusa).
      const caixaMes =
        equityCall + draw + revenue[m] - pagamentos - amortization - distribution;
      caixaAcumulado += caixaMes;
      saldoAnterior = saldoDevedor;

      meses.push({
        mes: m,
        data: somarMeses(input.dataInicio, m - 1),
        land: land[m],
        construction: construction[m],
        propertyTax: propertyTax[m],
        otherCosts: otherCosts[m],
        pagamentosOperacionais,
        juros,
        fee,
        custoFinanceiroCaixa,
        pagamentos,
        revenue: revenue[m],
        draw,
        amortization,
        equityCall,
        distribution,
        saldoDevedor,
        equityAcumulado,
        caixaAbertura,
        caixaMes,
        caixaAcumulado,
        demandaBruta: pagamentos + amortization - revenue[m],
        capacidadeSaque: capacidade,
      });
    }
    return meses;
  };

  // ─── Ponto fixo ────────────────────────────────────────────────────────────
  let estado: EstadoPonto = {
    feeTotal: 0,
    custoFinPorMes: zeros(),
    distribuicaoAutomatica: 0,
  };
  let meses: MesFluxo[] = [];
  let iteracoes = 0;
  let convergiu = false;

  const custoDiretoInput = terrenosTotal + obraTotal;

  for (let it = 0; it < MAX_ITERACOES; it++) {
    iteracoes = it + 1;
    meses = passe(estado);

    const dividaSacada = soma(meses.map((x) => x.draw));
    const equityTotal = soma(meses.map((x) => x.equityCall));
    const jurosTotais = soma(meses.map((x) => x.juros));
    const feeLancado = soma(meses.map((x) => x.fee));
    const custoEmpreendimento = soma(
      meses.map((x) => x.land + x.construction + x.propertyTax + x.otherCosts),
    );
    const receitaLiquida = vgv * fatorLiquido;
    const lucroProjeto = receitaLiquida - custoEmpreendimento - (jurosTotais + feeLancado);
    const lucroInvestidores = lucroProjeto * (rec.lucroInvestidoresPct || 0);

    const novoFee = dividaSacada * (fin.feeEstruturacaoPct || 0);
    const novoCustoFin = zeros();
    for (const x of meses) novoCustoFin[x.mes] = x.custoFinanceiroCaixa;
    const novaDist = equityTotal + lucroInvestidores;

    let delta = Math.max(
      Math.abs(novoFee - estado.feeTotal),
      Math.abs(novaDist - estado.distribuicaoAutomatica),
    );
    for (let m = 1; m <= prazoTotal; m++) {
      delta = Math.max(delta, Math.abs(novoCustoFin[m] - estado.custoFinPorMes[m]));
    }

    estado = { feeTotal: novoFee, custoFinPorMes: novoCustoFin, distribuicaoAutomatica: novaDist };
    if (it > 0 && delta < TOL_CONVERGENCIA) {
      convergiu = true;
      break;
    }
  }

  // ─── Apuração ──────────────────────────────────────────────────────────────
  // Nunca calcule o lucro como "receita líquida − quitação da dívida − devolução
  // do equity": isso só fecha quando fontes e usos batem exatamente, e quebra no
  // modo manual.
  const custoTerrenos = soma(meses.map((x) => x.land));
  const custoObra = soma(meses.map((x) => x.construction));
  const custoPropertyTax = soma(meses.map((x) => x.propertyTax));
  const custoOutros = soma(meses.map((x) => x.otherCosts));
  const custoEmpreendimento = custoTerrenos + custoObra + custoPropertyTax + custoOutros;
  const jurosTotais = soma(meses.map((x) => x.juros));
  const feeTotal = soma(meses.map((x) => x.fee));
  const custoFinanceiro = jurosTotais + feeTotal;
  const receitaBruta = vgv;
  const comissoes = vgv * (rec.comissaoPct || 0);
  const cartorio = vgv * (rec.custoCartorioPct || 0);
  const receitaLiquida = receitaBruta - comissoes - cartorio;
  const lucroProjeto = receitaLiquida - custoEmpreendimento - custoFinanceiro;
  const lucroInvestidores = lucroProjeto * (rec.lucroInvestidoresPct || 0);
  const lucroSponsor = lucroProjeto * (rec.lucroSponsorPct || 0);
  const equityTotal = soma(meses.map((x) => x.equityCall));
  const dividaSacada = soma(meses.map((x) => x.draw));
  const dividaAmortizada = soma(meses.map((x) => x.amortization));
  const totalPagamentos = soma(meses.map((x) => x.pagamentos));
  const totalDistribuido = equityTotal + lucroInvestidores;

  const apuracao: Apuracao = {
    receitaBruta,
    comissoes,
    cartorio,
    receitaLiquida,
    custoTerrenos,
    custoObra,
    custoPropertyTax,
    custoOutros,
    custoEmpreendimento,
    jurosTotais,
    feeTotal,
    custoFinanceiro,
    lucroProjeto,
    lucroInvestidores,
    lucroSponsor,
    equityTotal,
    dividaSacada,
    dividaAmortizada,
    totalPagamentos,
    totalDistribuido,
    tetoDivida,
  };

  // ─── Indicadores ───────────────────────────────────────────────────────────
  const fluxoInvestidor = meses.map((x) => x.distribution - x.equityCall);
  const tir = tirMensal(fluxoInvestidor);
  const indicadores: Indicadores = {
    moic: razao(totalDistribuido, equityTotal),
    roi: razao(lucroInvestidores, equityTotal),
    margemVgv: razao(lucroProjeto, vgv),
    ltc: razao(dividaSacada, terrenosTotal + obraTotal),
    alavancagem: razao(dividaSacada, totalPagamentos),
    // Custo ACUMULADO da dívida sobre o principal sacado — não é taxa a.a.
    custoTotalDividaPct: razao(custoFinanceiro, dividaSacada),
    tirMensal: tir,
    tirAnual: anualizar(tir),
    xirr: xirr(fluxoInvestidor, meses.map((x) => x.data)),
  };

  // ─── Rateio por sócio — todos pro-rata ─────────────────────────────────────
  // MOIC, ROI e TIR são idênticos para todos os sócios: só a escala muda.
  const rateioSocios: RateioSocio[] = socios.map((s) => {
    const p = s.participacaoPct || 0;
    return {
      nome: s.nome,
      participacaoPct: p,
      cotaDisponivel: !!s.cotaDisponivel,
      capital: p * equityTotal,
      lucro: p * lucroInvestidores,
      total: p * equityTotal + p * lucroInvestidores,
      chamadasPorMes: meses.map((x) => p * x.equityCall),
    };
  });

  // ─── Resultado por unidade ─────────────────────────────────────────────────
  // Rateio pro-rata pelo custo direto. Os custos que não pertencem a nenhuma
  // unidade (contingência, property tax, juros e fee) entram por esse fator, o
  // que garante Σ lucro das unidades = lucro do projeto.
  const compartilhado = custoEmpreendimento - custoDiretoInput + custoFinanceiro;
  const resultadoUnidades: ResultadoUnidade[] = unidades.map((u) => {
    const n = qtd(u);
    // Custo direto e receita da TIPOLOGIA inteira. Como custoDiretoInput também
    // já está multiplicado, o fatorRateio continua sendo uma fração do total e a
    // identidade Σ lucro das tipologias = lucro do projeto segue valendo.
    const custoDireto = ((u.custoTerreno || 0) + (u.custoObra || 0)) * n;
    const fatorRateio =
      custoDiretoInput > 0 ? custoDireto / custoDiretoInput : unidades.length > 0 ? 1 / unidades.length : 0;
    const custosCompartilhados = fatorRateio * (custoPropertyTax + custoOutros);
    const custoFinanceiroUnidade = fatorRateio * custoFinanceiro;
    const receitaLiquidaUnidade = (u.precoVenda || 0) * n * fatorLiquido;
    const extraRateado =
      fatorRateio * (custoEmpreendimento - custoDiretoInput - custoPropertyTax - custoOutros);
    const custoTotal =
      custoDireto + custosCompartilhados + custoFinanceiroUnidade + extraRateado;
    const lucro = receitaLiquidaUnidade - custoTotal;
    return {
      nome: u.nome,
      quantidade: n,
      custoTerreno: (u.custoTerreno || 0) * n,
      custoObra: (u.custoObra || 0) * n,
      custoDireto,
      fatorRateio,
      custosCompartilhados: custosCompartilhados + extraRateado,
      custoFinanceiro: custoFinanceiroUnidade,
      custoTotal,
      custoTotalUnitario: custoTotal / n,
      receitaLiquida: receitaLiquidaUnidade,
      receitaLiquidaUnitaria: receitaLiquidaUnidade / n,
      lucro,
      margem: razao(lucro, receitaLiquidaUnidade),
    };
  });

  const conferencias: Conferencia[] = montarConferencias({
    input,
    cronograma,
    agregados,
    meses,
    apuracao,
    convergiu,
    orfaos,
    compartilhado,
  });

  return {
    cronograma,
    agregados,
    meses,
    apuracao,
    indicadores,
    rateioSocios,
    resultadoUnidades,
    conferencias,
    fluxoInvestidor,
    iteracoes,
    convergiu,
    overridesOrfaos: orfaos,
    celulasManuais: ativos.size,
  };
}
