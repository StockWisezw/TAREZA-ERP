import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    css: {
      transformer: 'lightningcss',
      lightningcss: {
        targets: {
          chrome: 80,
          safari: 13,
          firefox: 72,
          edge: 80,
        },
      },
    },
    build: {
      cssMinify: 'lightningcss',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['lucide-react', 'motion', 'framer-motion', 'recharts'],
            'utils-vendor': ['date-fns', 'zod', 'zustand', 'uuid', 'react-hook-form']
          }
        }
      }
    }
  };
});
