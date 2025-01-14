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
        '@langchain/community/vectorstores/hnswlib',
        '@langchain/community/embeddings/ollama',
        '@langchain/community/llms/ollama'
      ]
    },
    emptyOutDir: false,
    target: 'node14'
  }
});
