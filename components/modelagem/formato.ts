/**
 * Formatação da modelagem.
 *
 * Arredondamento acontece SÓ aqui. O motor trabalha em ponto flutuante pleno —
 * nenhuma função deste arquivo é usada para calcular coisa alguma.
 */

/** Vazio ≠ zero: `null`/`undefined` viram traço, zero continua sendo "0,00". */
export function dinheiro(valor: number | null | undefined, moeda = 'USD'): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('en-US', {
    style: 'currency',
    currency: moeda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Compacto para grades largas: 1.712.755 vira "1.712.755". */
export function dinheiroCurto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  if (Math.abs(valor) < 0.005) return '0';
  return valor.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Indicador ausente vira "n/d" — nunca NaN, nunca 0. */
export function percentual(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'n/d';
  return `${(valor * 100).toFixed(casas)}%`;
}

export function multiplo(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'n/d';
  return `${valor.toFixed(4)}x`;
}

export function numero(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('en-US', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 'YYYY-MM-DD' → 'dez/25'. Sem `new Date()`: evita deslocamento por fuso. */
export function mesAno(dataIso: string): string {
  const [ano, mes] = dataIso.split('-').map(Number);
  if (!ano || !mes) return dataIso;
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy'. */
export function dataCurta(dataIso: string | null | undefined): string {
  if (!dataIso) return '—';
  const m = String(dataIso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(dataIso);
}

/** Converte o texto digitado numa célula em número. Vírgula decimal aceita. */
export function paraNumero(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.\-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  if (limpo === '' || limpo === '-') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}
