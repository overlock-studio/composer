import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const composerSrc = path.resolve(__dirname, '../../src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@overlock-studio/composer/styles/editor.css': path.join(
        composerSrc,
        'styles/editor.css',
      ),
      '@overlock-studio/composer': path.join(composerSrc, 'index.ts'),
      '@': composerSrc,
    },
    dedupe: ['react', 'react-dom', '@xyflow/react'],
  },
  server: {
    port: 5173,
    open: true,
  },
});
