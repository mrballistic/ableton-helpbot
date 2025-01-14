import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron']
    },
    lib: {
      entry: 'electron/main.mjs',
      formats: ['es'],
      fileName: () => 'main.mjs'
    },
    outDir: '.vite/build',
    emptyOutDir: true
  }
});
