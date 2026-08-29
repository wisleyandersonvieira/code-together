/**
 * Sensibilidade e pontos de equilíbrio.
 *
 * Tudo aqui roda o motor de novo com o input perturbado — nada é estimado por
 * interpolação. O lucro NÃO é linear no custo de obra: mexer na obra mexe na
 * curva de saque, que mexe nos juros. Por isso os pontos de equilíbrio saem por
 * bisseção sobre o próprio motor, não por fórmula fechada.
 */
import { calcular } from './motor';
import type { ModelInput, ModelOutput } from './tipos';

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
  const vgv = input.unidades.reduce((a, u) => a + (u.precoVenda || 0), 0);
  const obra = input.unidades.reduce((a, u) => a + (u.custoObra || 0), 0);

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
