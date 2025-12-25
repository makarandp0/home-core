import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API port for proxy - defaults to 3001, can be overridden for worktrees
const apiPort = process.env.HOME_API_PORT ?? process.env.VITE_API_PORT ?? '3001';

// Get git branch name at build time
function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

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
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(getGitBranch()),
  },
  server: {
    port: Number(process.env.HOME_WEB_PORT ?? process.env.VITE_PORT ?? 5173),
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
