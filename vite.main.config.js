import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config/
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
        ...builtinModules,
        'hnswlib-node',
        'electron',
        '@langchain/community',
        'langchain'
      ],
      output: {
        format: 'commonjs',
        preserveModules: true,
        preserveModulesRoot: '.'
      }
    },
    emptyOutDir: false,
    target: 'node14'
    }
});
