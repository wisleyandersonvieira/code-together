import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          radix: [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
          export: ['jspdf', 'jszip', 'xlsx'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@uibakery/data': path.resolve(__dirname, './lib/uibakery-shim.ts'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    host: "::",
    port: 8080,
  },
});
