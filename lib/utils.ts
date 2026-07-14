import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapa um valor de busca antes de ele ser interpolado na SQL pelas actions do
 * @uibakery/data (que montam a query por concatenação de string, sem bind de
 * parâmetros). Remove caracteres de controle e barras invertidas e duplica as
 * aspas simples, para que buscas como "D'Angelo" funcionem e não seja possível
 * encerrar o literal e injetar SQL.
 */
export function sanitizeSearchParam(value: string): string {
  if (!value) return value;

  const semCaracteresDeControle = Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  return semCaracteresDeControle.replace(/\\/g, '').replace(/'/g, "''");
}
