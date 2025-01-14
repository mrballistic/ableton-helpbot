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
      external: [
        'electron',
        '@langchain/community',
        'langchain'
      ],
      output: {
        format: 'cjs',
        preserveModules: true,
        preserveModulesRoot: '.'
      }
    },
    emptyOutDir: false,
    target: 'node14'
  }
});
