import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3001,
    cors: true,
    open: true,  // Add this to auto-open browser
    // Or explicitly specify Chrome:
    // open: '/public/demo.html',  // Opens the demo page
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'CSAIWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'widget.[ext]',
      },
    },
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
  },
});
