import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'electron',
    rollupOptions: {
      external: ['electron']
    },
    lib: {
      entry: 'electron/main.mjs',
      formats: ['cjs'],
      fileName: () => 'main.cjs'
    },
    emptyOutDir: false
  }
});
