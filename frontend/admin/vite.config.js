import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      // Email routes - don't rewrite (backend has /api/email for OAuth callback)
      '/api/email': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Customer routes - don't rewrite (backend has /api/customer)
      '/api/customer': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Other API routes - rewrite to remove /api prefix
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
