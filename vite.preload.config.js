import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'electron',
    rollupOptions: {
      external: ['electron']
    },
    lib: {
      entry: 'electron/preload.cjs',
      formats: ['cjs'],
      fileName: () => 'preload.cjs'
    },
    emptyOutDir: false
  }
});
