import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // esbuild minification is on by default for JS; CSS is minified too. Source maps stay
    // off so they are not shipped to clients.
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,   // build-time only: saves a gzip pass over every chunk
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React and the router change only when we upgrade them. Keeping them in their own
        // chunk means an app deploy does not invalidate them in everyone's browser cache.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'data-vendor': ['swr', 'axios'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
});
