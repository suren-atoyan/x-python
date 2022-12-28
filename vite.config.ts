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
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'xPython',
      fileName: 'x-python',
    },
    rollupOptions: {
      external: ['pyodide'],
      output: {
        globals: {
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
