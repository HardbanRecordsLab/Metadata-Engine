
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    base: './',
    server: {
      host: '0.0.0.0', // Listen on all addresses
      port: 5173,      // Preferred port
      strictPort: false, // Allow fallback if 5173 is busy
      watch: {
        usePolling: true, // Needed for Windows Docker volumes
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8888',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'), // Keep /api prefix as backend expects it
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
    }
  };
});
