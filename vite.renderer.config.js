import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinModules } from 'module';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      external: [
        ...builtinModules,
        'hnswlib-node'
      ],
      output: {
        format: 'commonjs'
      }
    }
  }
});
