/**
 * Sensibilidade e pontos de equilíbrio.
 *
 * Tudo aqui roda o motor de novo com o input perturbado — nada é estimado por
 * interpolação. O lucro NÃO é linear no custo de obra: mexer na obra mexe na
 * curva de saque, que mexe nos juros. Por isso os pontos de equilíbrio saem por
 * bisseção sobre o próprio motor, não por fórmula fechada.
 */
import { calcular } from './motor';
import type { ModelInput, ModelOutput, Unidade } from './tipos';

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
    copia.financiamento.mesFimSaque = Math.max(copia.financiamento.mesFimSaque, novoPrazo);
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
export function gradeLocacao(
  input: ModelInput,
  variacoesAluguel: number[] = VARIACOES_ALUGUEL,
  variacoesCapRate: number[] = VARIACOES_CAP_RATE,
): CelulaLocacao[][] {
  const qtd = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));
  // Aluguel médio PONDERADO PELA ÁREA, que é a mesma conta de
  // `Indicadores.aluguelPorSf`: receita a 100% ÷ ABL. Uma média simples entre
  // tipologias de áreas diferentes daria um centro de grade que não corresponde
  // a modelagem nenhuma.
  const abl = input.unidades.reduce((a, u) => a + (u.areaSf || 0) * qtd(u), 0);
  const receita = input.unidades.reduce(
    (a, u) => a + (u.areaSf || 0) * (u.aluguelSfAno || 0) * qtd(u),
    0,
  );
  const aluguelBase = abl > 0 ? receita / abl : 0;
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
  /** Aluguel por sf/ano MÍNIMO que zera o lucro. */
  aluguelMinimoSf: number | null;
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
    return { capRateMaximo: null, aluguelMinimoSf: null, ocupacaoMinima: null };
  }

  const qtd = (u: Unidade) => Math.max(1, Math.trunc(u.quantidade || 1));
  const abl = input.unidades.reduce((a, u) => a + (u.areaSf || 0) * qtd(u), 0);
  const receita = input.unidades.reduce(
    (a, u) => a + (u.areaSf || 0) * (u.aluguelSfAno || 0) * qtd(u),
    0,
  );
  const aluguelBase = abl > 0 ? receita / abl : 0;
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

  return { capRateMaximo, aluguelMinimoSf, ocupacaoMinima };
}
