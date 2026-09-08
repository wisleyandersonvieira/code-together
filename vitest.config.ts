import path from 'path';
import { defineConfig } from 'vitest/config';

// Config separada da do Vite: os testes do motor são TypeScript puro, sem React
// e sem DOM, então não precisam do plugin nem do bundle de produção.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    // Os exportadores moram em components/, e o teste de caracteres precisa
    // varrer o fonte deles — continua sendo TypeScript puro, sem React nem DOM.
    // As ações moram em actions/, e a guarda de colunas gravadas varre o SQL
    // delas contra as migrations: também é TypeScript puro lendo arquivo.
    // O edge function `execute-sql` também: `sql-template.ts` é TypeScript puro,
    // sem API do Deno e sem import remoto, justamente para o escape e a guarda de
    // statements poderem ser cobrados por teste. O `index.ts`, que faz
    // `Deno.serve`, continua fora — e é por isso que a lógica saiu de lá.
    include: [
      'lib/**/*.test.ts',
      'components/**/*.test.ts',
      'actions/**/*.test.ts',
      // A guarda de colunas das FUNÇÕES de banco mora junto das migrations que
      // ela varre: também é TypeScript puro lendo arquivo .sql.
      'migrations/**/*.test.ts',
      'supabase/functions/**/*.test.ts',
    ],
  },
});
