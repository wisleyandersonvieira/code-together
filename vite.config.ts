import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, Plugin } from 'vite';
import fs from 'fs';

const SOURCE_DIRS = ['actions', 'app', 'components', 'hooks', 'lib', 'migrations', 'types', 'utils', 'scripts', 'docs'];
const ROOT_FILES = [
  'package.json', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.json',
  'tsconfig.app.json', 'tsconfig.node.json', 'tsconfig-runtime.json',
  'vite.config.ts', 'vite-env.d.ts', 'index.html', 'index.css',
  'components.json', 'eslint.config.js', 'README.md', 'supabase_setup.sql', '.gitignore',
];

function projectFilesPlugin(): Plugin {
  return {
    name: 'project-files-plugin',
    configureServer(server) {
      server.middlewares.use('/__project_files', (_req, res) => {
        const cwd = process.cwd();
        const files: Record<string, string> = {};

        const addFile = (relPath: string) => {
          const absPath = path.join(cwd, relPath);
          try {
            if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
              files[relPath] = fs.readFileSync(absPath, 'utf-8');
            }
          } catch { /* skip binary or unreadable files */ }
        };

        // Root files
        for (const f of ROOT_FILES) addFile(f);

        // Directories
        const walk = (dir: string) => {
          const abs = path.join(cwd, dir);
          if (!fs.existsSync(abs)) return;
          for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const rel = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(rel);
            } else {
              addFile(rel);
            }
          }
        };
        for (const d of SOURCE_DIRS) walk(d);

        const json = JSON.stringify({ files, fileCount: Object.keys(files).length });
        res.setHeader('Content-Type', 'application/json');
        res.end(json);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), projectFilesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'app/index.ts'),
      name: 'ShadcnLib',
      fileName: format => `shadcn-template.${format}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-hook-form'],
      output: {
        format: 'iife',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        assetFileNames: assetInfo => {
          return assetInfo.name === 'style.css' ? 'shadcn-template.css' : assetInfo.name || 'asset';
        },
      },
    },
    minify: false,
    sourcemap: false,
  },
});
