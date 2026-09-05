/**
 * Sensibilidade e pontos de equilíbrio.
 *
 * Tudo aqui roda o motor de novo com o input perturbado — nada é estimado por
 * interpolação. O lucro NÃO é linear no custo de obra: mexer na obra mexe na
 * curva de saque, que mexe nos juros. Por isso os pontos de equilíbrio saem por
 * bisseção sobre o próprio motor, não por fórmula fechada.
 */
import { calcular } from './motor';
import type { Financiamento, ModelInput, ModelOutput, Unidade } from './tipos';

/** Modo de negócio do input. Ausente = 'venda', como em todo o módulo. */
const ehLocacao = (input: ModelInput) => (input.tipoModelagem ?? 'venda') === 'locacao';

export interface CelulaSensibilidade {
  variacaoPreco: number;
  variacaoCusto: number;
  lucroProjeto: number;
  moic: number | null;
  tirAnual: number | null;
}

const clonar = (input: ModelInput): ModelInput => JSON.parse(JSON.stringify(input));

/** Aplica fatores multiplicativos ao preço de venda e ao custo de obra. */
export function perturbar(input: ModelInput, fatorPreco: number, fatorCusto: number): ModelInput {
  const copia = clonar(input);
  copia.unidades = copia.unidades.map((u) => ({
    ...u,
    precoVenda: u.precoVenda * fatorPreco,
    custoObra: u.custoObra * fatorCusto,
  }));
  return copia;
}

export const VARIACOES_PRECO = [-0.15, -0.1, -0.05, 0, 0.05, 0.1];
export const VARIACOES_CUSTO = [-0.05, 0, 0.05, 0.1, 0.15];

/**
 * Grade de duas entradas: preço de venda nas linhas, custo de obra nas colunas.
 * Cada célula é uma rodada completa do motor.
 */
export function gradeSensibilidade(
  input: ModelInput,
  variacoesPreco: number[] = VARIACOES_PRECO,
  variacoesCusto: number[] = VARIACOES_CUSTO,
): CelulaSensibilidade[][] {
  return variacoesPreco.map((vp) =>
    variacoesCusto.map((vc) => {
      const out = calcular(perturbar(input, 1 + vp, 1 + vc));
      return {
        variacaoPreco: vp,
        variacaoCusto: vc,
        lucroProjeto: out.apuracao.lucroProjeto,
        moic: out.indicadores.moic,
        tirAnual: out.indicadores.tirAnual,
      };
    }),
  );
}

/**
 * Bisseção sobre um fator até o lucro do projeto zerar.
 * Devolve null quando não há troca de sinal no intervalo — não force um número.
 */
function fatorDeEquilibrio(
  input: ModelInput,
  aplicar: (fator: number) => ModelInput,
  baixo: number,
  alto: number,
): number | null {
  const lucro = (f: number) => calcular(aplicar(f)).apuracao.lucroProjeto;
  let lo = baixo;
  let hi = alto;
  const fLo = lucro(lo);
  const fHi = lucro(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return null;
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 80; i++) {
    const meio = (lo + hi) / 2;
    if (lucro(lo) * lucro(meio) <= 0) hi = meio;
    else lo = meio;
  }
  return (lo + hi) / 2;
}

export interface PontosEquilibrio {
  /** VGV que zera o lucro do projeto. */
  vgvMinimo: number | null;
  /** Queda máxima admissível no preço de venda, como fração (0.12 = 12%). */
  quedaMaximaPreco: number | null;
  /** Custo de obra que zera o lucro. */
  custoObraMaximo: number | null;
  /** Alta máxima admissível no custo de obra, como fração. */
  altaMaximaCusto: number | null;
}

export function pontosDeEquilibrio(input: ModelInput): PontosEquilibrio {
  // Totais do projeto, não por unidade: os valores da tipologia são unitários.
  const qtd = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));
  const vgv = input.unidades.reduce((a, u) => a + (u.precoVenda || 0) * qtd(u), 0);
  const obra = input.unidades.reduce((a, u) => a + (u.custoObra || 0) * qtd(u), 0);

  const fatorPreco = fatorDeEquilibrio(input, (f) => perturbar(input, f, 1), 0.01, 1);
  const fatorCusto = fatorDeEquilibrio(input, (f) => perturbar(input, 1, f), 1, 10);

  return {
    vgvMinimo: fatorPreco === null ? null : vgv * fatorPreco,
    quedaMaximaPreco: fatorPreco === null ? null : 1 - fatorPreco,
    custoObraMaximo: fatorCusto === null ? null : obra * fatorCusto,
    altaMaximaCusto: fatorCusto === null ? null : fatorCusto - 1,
  };
}

export interface AtrasoVenda {
  mesesAtraso: number;
  prazoTotal: number;
  moic: number | null;
  tirAnual: number | null;
  lucroProjeto: number;
}

/**
 * Efeito de atrasar a venda. O atraso entra como pós-obra a mais, o que estende
 * o property tax, a janela de saque e — principalmente — a curva de juros, já
 * que a dívida só é quitada na saída.
 */
export function sensibilidadePrazo(
  input: ModelInput,
  atrasos: number[] = [0, 3, 6, 12],
): AtrasoVenda[] {
  return atrasos.map((meses) => {
    const copia = clonar(input);
    copia.mesesPosObra = copia.mesesPosObra + meses;
    const novoPrazo = copia.mesesAprovacao + copia.mesesConstrucao + copia.mesesPosObra;
    // A saída acompanha o atraso; a janela de saque também, senão o saque
    // ficaria travado antes do novo mês de quitação.
    if (input.receita.mesSaida != null) copia.receita.mesSaida = novoPrazo;

    // A janela de TODAS as facilidades, e nas DUAS formas de input.
    //
    // Ler `copia.financiamento` direto era o que quebrava aqui: desde a migration
    // 1764200000 `mapearModelInput` devolve `financiamentos` e NUNCA o campo
    // único, então toda modelagem carregada do banco chegava com ele
    // `undefined` — e o acesso estourava `TypeError`, derrubando os dois
    // relatórios em PDF e a aba Sensibilidade inteiros. O caso singular continua
    // tratado porque o input de teste ainda usa essa forma.
    //
    // Estender só a primeira facilidade seria pior que estourar: a segunda
    // ficaria com a janela travada antes do novo mês de quitação, o saque dela
    // sumiria e o "efeito do atraso" mediria também a perda de uma linha de
    // crédito que ninguém mexeu.
    const estender = (f: Financiamento): Financiamento => ({
      ...f,
      mesFimSaque: Math.max(f.mesFimSaque, novoPrazo),
    });
    if (copia.financiamentos && copia.financiamentos.length > 0) {
      copia.financiamentos = copia.financiamentos.map(estender);
    } else if (copia.financiamento) {
      copia.financiamento = estender(copia.financiamento);
    }
    const out: ModelOutput = calcular(copia);
    return {
      mesesAtraso: meses,
      prazoTotal: out.cronograma.prazoTotal,
      moic: out.indicadores.moic,
      tirAnual: out.indicadores.tirAnual,
      lucroProjeto: out.apuracao.lucroProjeto,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSIBILIDADE DO MODO LOCAÇÃO
//
// No modo venda nada aqui é alcançado, e nada acima muda: `gradeSensibilidade`,
// `pontosDeEquilibrio` e `sensibilidadePrazo` continuam exatamente como estavam.
//
// Os EIXOS mudam porque as alavancas mudam. Num projeto de venda o que decide é
// preço de venda × custo de obra. Num projeto de locação o preço de venda não
// existe: o ativo vale NOI ÷ cap rate, e as duas alavancas são o ALUGUEL POR SF
// (que faz o NOI) e o CAP RATE DE SAÍDA (que o divide). Um ponto percentual de
// cap rate move o valor de saída mais do que qualquer coisa sob controle do
// incorporador — e é por isso que ele é um eixo, e não uma premissa fixa.
// ─────────────────────────────────────────────────────────────────────────────

export interface CelulaLocacao {
  /** Cap rate ABSOLUTO daquela coluna, não variação. 0.075 = 7,5%. */
  capRate: number;
  /** Aluguel por sf/ano ABSOLUTO daquela linha, não variação. */
  aluguelSf: number;
  lucroProjeto: number;
  moic: number | null;
  /** Para a célula poder mostrar de onde veio o lucro. */
  valorSaida: number | null;
  tirAnual: number | null;
}

/**
 * Aplica um cap rate e um aluguel por sf ABSOLUTOS.
 *
 * Absolutos, e não fatores multiplicativos como no modo venda: um cap rate é uma
 * taxa de mercado que o usuário cota em pontos-base ("e se o comprador pedir
 * 8%?"), não algo que se move em percentual de si mesmo. "Cap rate 10% maior"
 * não é uma pergunta que alguém faça.
 *
 * O aluguel é aplicado a TODAS as tipologias por igual. Preservar a proporção
 * entre elas — como o modo venda faz com o preço — exigiria um fator, e aí a
 * grade deixaria de ter um eixo legível em dólares por pé quadrado.
 */
export function perturbarLocacao(
  input: ModelInput,
  capRate: number,
  aluguelSf: number,
): ModelInput {
  const copia = clonar(input);
  copia.unidades = copia.unidades.map((u) => ({ ...u, aluguelSfAno: aluguelSf }));
  copia.locacao = {
    taxaReembolsoPct: 0,
    perdaCreditoPct: 0,
    custoVendaPct: 0,
    noiReferencia: 'estabilizado',
    ocupacaoEstabilizadaPct: 1,
    ...(copia.locacao ?? {}),
    capRateSaida: capRate,
  };
  return copia;
}

/** Cap rates cotados em pontos-base ao redor do declarado, como o mercado cota. */
export const VARIACOES_CAP_RATE = [-0.01, -0.005, 0, 0.005, 0.01];
/** Aluguel em dólares por sf/ano ao redor do declarado. */
export const VARIACOES_ALUGUEL = [-3, -2, -1, 0, 1, 2];

/**
 * Grade do modo locação: aluguel por sf nas linhas, cap rate de saída nas
 * colunas. Cada célula é uma rodada completa do motor — nada é interpolado, e
 * pelo mesmo motivo do modo venda: o lucro não é linear em nenhum dos dois
 * eixos, porque os dois mexem no NOI, que mexe no valor de saída, que mexe na
 * distribuição e no MOIC.
 *
 * Os deslocamentos são ABSOLUTOS e partem do que a modelagem declara: o aluguel
 * médio ponderado pela área e o cap rate gravado. Uma modelagem sem aluguel
 * nenhum parte de zero, e a linha de baixo da grade fica negativa — que é a
 * leitura correta.
 */
/**
 * Aluguel médio PONDERADO PELA ÁREA — a mesma conta de `Indicadores.aluguelPorSf`:
 * receita a 100% ÷ ABL.
 *
 * Uma média simples entre tipologias de áreas diferentes daria um centro de grade
 * que não corresponde a modelagem nenhuma. Está numa função só porque as três
 * grades de locação partem exatamente deste ponto.
 */
function aluguelMedioSf(input: ModelInput): number {
  const qtd = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));
  const abl = input.unidades.reduce((a, u) => a + (u.areaSf || 0) * qtd(u), 0);
  const receita = input.unidades.reduce(
    (a, u) => a + (u.areaSf || 0) * (u.aluguelSfAno || 0) * qtd(u),
    0,
  );
  return abl > 0 ? receita / abl : 0;
}

export function gradeLocacao(
  input: ModelInput,
  variacoesAluguel: number[] = VARIACOES_ALUGUEL,
  variacoesCapRate: number[] = VARIACOES_CAP_RATE,
): CelulaLocacao[][] {
  const aluguelBase = aluguelMedioSf(input);
  const capBase = input.locacao?.capRateSaida ?? 0;

  return variacoesAluguel.map((da) =>
    variacoesCapRate.map((dc) => {
      // Cap rate NUNCA negativo nem zero na grade: zero devolveria valor de
      // saída zero em toda a coluna (o motor não divide por zero) e a leitura
      // ficaria sem sentido. O piso de 0,25% é abaixo de qualquer cap real.
      const capRate = Math.max(0.0025, capBase + dc);
      const aluguelSf = Math.max(0, aluguelBase + da);
      const out = calcular(perturbarLocacao(input, capRate, aluguelSf));
      return {
        capRate,
        aluguelSf,
        lucroProjeto: out.apuracao.lucroProjeto,
        moic: out.indicadores.moic,
        valorSaida: out.indicadores.valorSaida,
        tirAnual: out.indicadores.tirAnual,
      };
    }),
  );
}

export interface PontosEquilibrioLocacao {
  /**
   * Cap rate MÁXIMO que ainda deixa o lucro do projeto em zero. Acima dele o
   * comprador paga menos do que o ativo custou. É o teto de risco de mercado que
   * o projeto suporta.
   */
  capRateMaximo: number | null;
  /**
   * `capRateMaximo − capRateSaida`, em PONTOS-BASE. É o quanto o cap pode abrir
   * antes de o projeto deixar de dar lucro — a grandeza que o mercado de fato
   * cota, e a que a capa do relatório para sócios anuncia.
   *
   * Existe como campo, e não como conta na página, pela mesma razão de todo o
   * resto: um número no relatório sai da apuração ou de uma função pura testada,
   * nunca de aritmética feita dentro do desenho.
   */
  expansaoMaximaCapBps: number | null;
  /** Aluguel por sf/ano MÍNIMO que zera o lucro. */
  aluguelMinimoSf: number | null;
  /**
   * NOI anual de referência no ponto em que o lucro zera — o NOI que sustenta o
   * projeto no limite.
   *
   * Sai de rodar o motor com `aluguelMinimoSf` e LER `indicadores.noiEstabilizado`
   * da rodada, e não de multiplicar o aluguel de equilíbrio por área: assim a
   * vacância, a perda de crédito e o reembolso entram pela mesma conta que faz o
   * NOI de referência em qualquer outro lugar.
   */
  noiMinimo: number | null;
  /**
   * Ocupação estabilizada MÍNIMA que zera o lucro. Não é a mesma coisa que
   * `Indicadores.ocupacaoBreakevenNoi`, e a diferença importa: aquela é a
   * ocupação em que o NOI DO MÊS deixa de ser negativo; esta é a que faz o
   * PROJETO INTEIRO — incluindo terreno, obra, juros e valor de saída — empatar.
   * Esta é sempre a mais alta das duas.
   */
  ocupacaoMinima: number | null;
}

/**
 * Pontos de equilíbrio do modo locação, por bisseção sobre o próprio motor.
 *
 * Mesma postura do modo venda: nada é resolvido por fórmula fechada, porque o
 * lucro não é linear em nenhum dos três — mexer no aluguel mexe no NOI, que mexe
 * no valor de saída E na receita mês a mês, que mexe no caixa, que mexe no saque
 * e nos juros.
 *
 * `null` quando não há troca de sinal no intervalo varrido — nunca um número
 * forçado. Um cap rate de equilíbrio inventado é pior que um "n/d".
 */
export function pontosDeEquilibrioLocacao(input: ModelInput): PontosEquilibrioLocacao {
  if (!ehLocacao(input)) {
    return {
      capRateMaximo: null,
      expansaoMaximaCapBps: null,
      aluguelMinimoSf: null,
      noiMinimo: null,
      ocupacaoMinima: null,
    };
  }

  const aluguelBase = aluguelMedioSf(input);
  const capBase = input.locacao?.capRateSaida ?? 0;
  const ocupBase = input.locacao?.ocupacaoEstabilizadaPct ?? 1;

  // O cap rate ENTRA no denominador do valor de saída, então lucro é DECRESCENTE
  // nele: o intervalo vai do quase-zero (lucro máximo) a 30% (lucro mínimo).
  // `fatorDeEquilibrio` já exige troca de sinal, e devolve null se não houver.
  const capRateMaximo = fatorDeEquilibrio(
    input,
    (f) => perturbarLocacao(input, f, aluguelBase),
    0.0025,
    0.3,
  );

  const aluguelMinimoSf = fatorDeEquilibrio(
    input,
    (f) => perturbarLocacao(input, capBase > 0 ? capBase : 0.075, f),
    0,
    // Teto generoso: 5× o aluguel declarado, ou $200/sf se não há aluguel
    // nenhum declarado — sem um teto absoluto, uma modelagem zerada não teria
    // intervalo de busca.
    Math.max(aluguelBase * 5, 200),
  );

  const comOcupacao = (o: number): ModelInput => {
    const copia = clonar(input);
    copia.locacao = { ...(copia.locacao ?? perturbarLocacao(input, capBase, aluguelBase).locacao!), ocupacaoEstabilizadaPct: o };
    // A CURVA também acompanha, e não só a ocupação estabilizada: sem isso a
    // receita mês a mês ficaria na curva original e só o valor de saída mudaria
    // — o "breakeven" resultante seria de um projeto que não existe.
    copia.ocupacao = (input.ocupacao ?? []).map((p) => ({
      ...p,
      ocupacaoPct: Math.min(1, ocupBase > 0 ? (p.ocupacaoPct * o) / ocupBase : o),
    }));
    return copia;
  };
  const ocupacaoMinima = fatorDeEquilibrio(input, comOcupacao, 0, 1);

  // O NOI do ponto de equilíbrio sai do MOTOR rodado no aluguel de equilíbrio, e
  // não de uma fórmula refeita aqui: é o mesmo `noiEstabilizado` que divide o cap
  // em qualquer outra tela, e por isso não tem como divergir dele.
  const noiMinimo =
    aluguelMinimoSf === null
      ? null
      : calcular(perturbarLocacao(input, capBase > 0 ? capBase : 0.075, aluguelMinimoSf))
          .indicadores.noiEstabilizado;

  return {
    capRateMaximo,
    expansaoMaximaCapBps: capRateMaximo === null ? null : (capRateMaximo - capBase) * 10_000,
    aluguelMinimoSf,
    noiMinimo,
    ocupacaoMinima,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A GRADE DO RELATÓRIO PARA SÓCIOS: CAP DE SAÍDA × CUSTO DE OBRA
//
// `gradeLocacao` — aluguel × cap — é a grade da TELA, e continua como está: lá o
// leitor está calibrando as duas premissas que ele próprio digitou.
//
// O relatório para sócios pede outra pergunta. Nele o eixo horizontal é o custo
// de obra nos dois modos, porque estouro de obra é o risco que o investidor
// reconhece; o que muda é o eixo vertical. Num projeto de venda é o preço; num de
// locação o preço de venda NÃO EXISTE, e uma matriz de preço sai constante em
// toda linha — foi o que produziu, na capa, a frase "não há queda de preço que o
// leve ao prejuízo", que num documento de abertura se lê como "sem risco de
// queda". O que ocupa esse lugar é o CAP DE SAÍDA: é ele que decide quanto o
// comprador paga, e é a variável que ninguém no projeto controla.
// ─────────────────────────────────────────────────────────────────────────────

export interface CelulaCapObra {
  /** Deslocamento em pontos-base sobre o cap contratado. −50 = 50 bps abaixo. */
  deltaCapBps: number;
  /** Cap rate ABSOLUTO desta linha, já com o piso aplicado. */
  capRate: number;
  /** Variação do custo de obra, como fração. 0.1 = obra 10% mais cara. */
  variacaoCusto: number;
  lucroProjeto: number;
  moic: number | null;
  tirAnual: number | null;
  valorSaida: number | null;
}

/**
 * Cap de saída em PONTOS-BASE ao redor do contratado — como o mercado cota.
 *
 * Assimétrico de propósito: um cap comprime pouco e abre muito. Um ciclo de alta
 * de juros move o cap de saída 150 bps para cima sem dificuldade nenhuma, e é
 * esse lado que o investidor precisa ver.
 */
export const VARIACOES_CAP_BPS = [-100, -50, 0, 50, 100, 150];

/**
 * Grade do relatório: cap de saída nas linhas, custo de obra nas colunas.
 *
 * Cada célula é uma rodada completa do motor. Nada é interpolado, e pelo mesmo
 * motivo de sempre: mexer na obra mexe na curva de saque, que mexe nos juros, que
 * mexem no lucro — e mexer no cap mexe no valor de saída, que mexe na
 * distribuição e no MOIC. Nenhum dos dois eixos é linear.
 *
 * O piso de 0,25% no cap é o mesmo de `gradeLocacao`: cap zero devolveria valor
 * de saída zero na linha inteira e a leitura ficaria sem sentido.
 */
export function gradeCapObra(
  input: ModelInput,
  variacoesCapBps: number[] = VARIACOES_CAP_BPS,
  variacoesCusto: number[] = VARIACOES_CUSTO,
): CelulaCapObra[][] {
  const capBase = input.locacao?.capRateSaida ?? 0;
  return variacoesCapBps.map((bps) => {
    const capRate = Math.max(0.0025, capBase + bps / 10_000);
    return variacoesCusto.map((vc) => {
      // O cap entra pela config de locação e a obra pelo fator multiplicativo das
      // tipologias — as duas perturbações que o módulo já sabe aplicar, uma
      // depois da outra, sem uma terceira forma de mexer no input.
      const comCap = perturbarLocacao(input, capRate, aluguelMedioSf(input));
      const out = calcular(perturbar(comCap, 1, 1 + vc));
      return {
        deltaCapBps: bps,
        capRate,
        variacaoCusto: vc,
        lucroProjeto: out.apuracao.lucroProjeto,
        moic: out.indicadores.moic,
        tirAnual: out.indicadores.tirAnual,
        valorSaida: out.indicadores.valorSaida,
      };
    });
  });
}
