import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content.js'),
      name: 'webmdContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});