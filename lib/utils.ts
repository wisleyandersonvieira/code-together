import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Higieniza um valor de busca antes de ele ser interpolado na SQL pelas actions
 * do @uibakery/data (que montam a query por concatenação de string, sem bind de
 * parâmetros). Remove caracteres de controle e barras invertidas.
 *
 * NÃO duplica as aspas simples, e isso é deliberado: quem escapa é o edge
 * function, no caminho de interpolação em que o valor de fato cai — ver
 * supabase/functions/execute-sql/sql-template.ts. Duplicar aqui TAMBÉM foi o bug
 * do escape duplo, que gravava "D''Angelo" e dobrava a cada salvamento.
 */
export function sanitizeSearchParam(value: string): string {
  if (!value) return value;

  const semCaracteresDeControle = Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  return semCaracteresDeControle.replace(/\\/g, '');
}
