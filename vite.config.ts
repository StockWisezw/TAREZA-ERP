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
          chrome: 50,
          safari: 11,
          firefox: 50,
          edge: 15,
        },
      },
    },
    build: {
      cssMinify: 'esbuild',
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
