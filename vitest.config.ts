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
    include: ['lib/**/*.test.ts'],
  },
});
