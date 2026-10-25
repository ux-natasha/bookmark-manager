import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Builds the extension into dist/. Load that folder via edge://extensions → "Load unpacked".
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        library: resolve(__dirname, 'library.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        // The manifest points at a fixed background.js path, so that entry can't be hashed.
        entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    environment: 'node',
  },
}));
