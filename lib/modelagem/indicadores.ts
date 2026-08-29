/**
 * Indicadores de retorno — funções puras.
 *
 * Regra que vale para o arquivo inteiro: quando o indicador não existe, o
 * retorno é `null`, nunca `NaN` e nunca `0`. A interface mostra "n/d".
 */

/** Tolerância padrão para comparação de floats. Nunca compare com `==`. */
export const TOLERANCIA = 0.01;

export const quaseIgual = (a: number, b: number, tol = TOLERANCIA) =>
  Math.abs(a - b) <= tol;

/**
 * Soma de meses segura no fim do mês, em UTC.
 * 31/01 + 1 mês = 28 ou 29/02, nunca 03/03. Sem fuso local: 'YYYY-MM-DD' entra
 * e sai como string, então o resultado não muda conforme o timezone da máquina.
 */
export function somarMeses(dataIso: string, meses: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const alvo = mes - 1 + meses;
  const anoFinal = ano + Math.floor(alvo / 12);
  const mesFinal = ((alvo % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anoFinal, mesFinal + 1, 0)).getUTCDate();
  const diaFinal = Math.min(dia, ultimoDia);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${anoFinal}-${p(mesFinal + 1)}-${p(diaFinal)}`;
}

/** Dias corridos entre duas datas ISO, em UTC. */
export function diasEntre(inicioIso: string, fimIso: string): number {
  const ms = Date.parse(`${fimIso}T00:00:00Z`) - Date.parse(`${inicioIso}T00:00:00Z`);
  return ms / 86_400_000;
}

const vpl = (fluxo: number[], taxa: number) =>
  fluxo.reduce((acc, f, i) => acc + f / Math.pow(1 + taxa, i + 1), 0);

const temTrocaDeSinal = (fluxo: number[]) => {
  let positivo = false;
  let negativo = false;
  for (const f of fluxo) {
    if (f > 0) positivo = true;
    if (f < 0) negativo = true;
  }
  return positivo && negativo;
};

const LIMITE_INFERIOR = -0.99;
const LIMITE_SUPERIOR = 1.0;

/**
 * TIR mensal por bisseção sobre o fluxo do investidor.
 *
 * Duas guardas, e as duas importam:
 *  1. o fluxo precisa trocar de sinal — sem isso não existe raiz;
 *  2. o VPL precisa trocar de sinal ENTRE OS EXTREMOS do intervalo.
 *
 * A guarda 2 é a que de fato sustenta a bisseção. Sem ela, um projeto com TIR
 * acima de 100% ao mês devolveria o extremo do intervalo como se fosse
 * resultado — um número inventado em vez de um `null` honesto.
 */
export function tirMensal(fluxo: number[]): number | null {
  if (!temTrocaDeSinal(fluxo)) return null;

  let baixo = LIMITE_INFERIOR;
  let alto = LIMITE_SUPERIOR;
  const vplBaixo = vpl(fluxo, baixo);
  const vplAlto = vpl(fluxo, alto);
  if (!Number.isFinite(vplBaixo) || !Number.isFinite(vplAlto)) return null;
  if (vplBaixo * vplAlto > 0) return null;

  for (let i = 0; i < 200; i++) {
    const meio = (baixo + alto) / 2;
    if (vpl(fluxo, baixo) * vpl(fluxo, meio) <= 0) alto = meio;
    else baixo = meio;
  }
  const taxa = (baixo + alto) / 2;
  return Number.isFinite(taxa) ? taxa : null;
}

/** Converte taxa mensal em anual. Devolve null se a mensal for null. */
export function anualizar(mensal: number | null): number | null {
  if (mensal === null) return null;
  const anual = Math.pow(1 + mensal, 12) - 1;
  return Number.isFinite(anual) ? anual : null;
}

/**
 * XIRR com as datas reais, base actual/365. Indicador secundário: usa os mesmos
 * fluxos da TIR, mas respeita o espaçamento real entre as datas.
 */
export function xirr(fluxo: number[], datas: string[]): number | null {
  if (fluxo.length === 0 || fluxo.length !== datas.length) return null;
  if (!temTrocaDeSinal(fluxo)) return null;

  const base = datas[0];
  const anos = datas.map((d) => diasEntre(base, d) / 365);
  const f = (taxa: number) =>
    fluxo.reduce((acc, v, i) => acc + v / Math.pow(1 + taxa, anos[i]), 0);

  let baixo = -0.9999;
  let alto = 1000;
  const fBaixo = f(baixo);
  const fAlto = f(alto);
  if (!Number.isFinite(fBaixo) || !Number.isFinite(fAlto)) return null;
  if (fBaixo * fAlto > 0) return null;

  for (let i = 0; i < 200; i++) {
    const meio = (baixo + alto) / 2;
    if (f(baixo) * f(meio) <= 0) alto = meio;
    else baixo = meio;
  }
  const taxa = (baixo + alto) / 2;
  return Number.isFinite(taxa) ? taxa : null;
}

/** Divisão que devolve null em vez de Infinity/NaN quando o denominador é zero. */
export function razao(numerador: number, denominador: number): number | null {
  if (!Number.isFinite(denominador) || Math.abs(denominador) < 1e-9) return null;
  const r = numerador / denominador;
  return Number.isFinite(r) ? r : null;
}
