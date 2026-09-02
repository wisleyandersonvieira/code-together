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
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts', 'actions/**/*.test.ts'],
  },
});
