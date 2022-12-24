// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

import virtualHtml from 'vite-plugin-virtual-html';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
    virtualHtml({
      pages: {
        index: '/playground/index.html',
      },
      indexPage: 'index',
    }),
  ],
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/main.ts'),
      name: '@x-python/core',
      fileName: 'main.ts',
    },
    rollupOptions: {
      external: ['state-local', 'immer', 'pyodide'],
      output: {
        exports: 'auto',
      },
    },
  },
  worker: {
    format: 'es',
  },
});
