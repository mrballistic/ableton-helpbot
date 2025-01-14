import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'renderer',
    assetsDir: 'assets',
    rollupOptions: {
      external: ['electron'],
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@public': resolve(__dirname, 'public')
    }
  },
  publicDir: 'public'
});
