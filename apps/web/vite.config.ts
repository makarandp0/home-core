// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API port for proxy - defaults to 3001, can be overridden for worktrees
const apiPort = process.env.OHS_API_PORT ?? process.env.VITE_API_PORT ?? '3001';

// Get git info at build time
function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getGitCommitSha(): string {
  // CI sets COMMIT_SHA build arg (see Dockerfile and .github/workflows/publish.yml)
  if (process.env.COMMIT_SHA) {
    return process.env.COMMIT_SHA.slice(0, 7); // Short SHA
  }
  // Fall back to git command (works locally)
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Expose git info to the client at build time
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(getGitCommitSha()),
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(getGitBranch()),
  },
  server: {
    host: true,
    port: Number(process.env.OHS_WEB_PORT ?? process.env.VITE_PORT ?? 5173),
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
});
