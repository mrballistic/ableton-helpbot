import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.vite/build',
    lib: {
      entry: 'electron/main.cjs',
      formats: ['cjs'],
      fileName: () => 'main.cjs'
    },
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        inlineDynamicImports: true
      }
    },
    commonjsOptions: {
      include: [
        /node_modules/
      ],
      transformMixedEsModules: true,
      defaultIsModuleExports: true
    },
    emptyOutDir: false,
    target: 'node14'
  }
});
