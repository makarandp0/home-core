import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Expose a stable commit SHA to the client. Prefer CI-provided COMMIT_SHA,
  // and fall back to "dev" during local development.
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(
      process.env.COMMIT_SHA ?? 'dev',
    ),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
