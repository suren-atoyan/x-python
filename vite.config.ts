import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import type { ModuleFormat } from 'rollup';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
    {
      // enable cross-origin-isolation for SharedArrayBuffer
      // https://web.dev/cross-origin-isolation-guide/#enable-cross-origin-isolation
      name: 'configure-response-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          next();
        });
      },
    },
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'xPython',
      fileName: (format: ModuleFormat) => {
        switch (format) {
          case 'es':
            return 'x-python.js';
          case 'umd':
            return 'x-python.umd.js';
        }
      },
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
