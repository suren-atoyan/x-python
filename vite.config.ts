// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/main.ts'),
      name: '@x-python/core',
      fileName: 'x-python',
    },
    rollupOptions: {
      external: ['state-local', 'immer', 'pyodide'],
      output: {
        globals: {
          'state-local': 'state',
          immer: 'produce',
          pyodide: 'pyodide',
        },
      },
    },
  },
  server: {
    open: './playground/index.html',
  },
  worker: {
    format: 'es',
  },
});
