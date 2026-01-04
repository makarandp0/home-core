// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import Fastify from 'fastify';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import fastifyStatic from '@fastify/static';
import { healthRoutes } from './routes/health.js';
import { userRoutes } from './routes/user.js';
import { providersRoutes } from './routes/providers.js';
import { documentsRoutes } from './routes/documents.js';
import { settingsRoutes } from './routes/settings.js';
import { ownerAliasRoutes } from './routes/owner-aliases.js';
import { initializeFirebase, isAuthEnabled } from './services/firebase-admin.js';
import { registerAuthMiddleware } from './middleware/auth.js';

async function main() {
  // Log startup info for debugging
  console.log('=== openHomeStorage API Starting ===');
  console.log(`Version: ${process.env.COMMIT_SHA ?? 'dev'}`);
  console.log(`Node: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
  console.log(`Working directory: ${process.cwd()}`);

  // Run database migrations on startup
  // TODO: Consider using Railway's release command instead for production deployments
  // TODO: With multiple replicas, concurrent migrations could cause issues - consider using advisory locks
  // TODO: This blocks server startup - for large migrations, use a separate migration job
  if (process.env.DATABASE_URL) {
    try {
      console.log('Running database migrations...');
      // Use migrate:up:prod in production (no dotenv wrapper needed since DATABASE_URL is already set)
      const script = process.env.NODE_ENV === 'production' ? 'migrate:up:prod' : 'migrate:up';
      const cmd = `pnpm --filter @ohs/db ${script}`;
      console.log(`Executing: ${cmd}`);
      execSync(cmd, { stdio: 'inherit' });
      console.log('Migrations complete');
    } catch (err) {
      console.error('Migration failed:', err);
      // Log additional debug info on failure
      console.error('Debug: Listing workspace packages...');
      try {
        execSync('pnpm list --depth 0', { stdio: 'inherit' });
      } catch {
        console.error('Failed to list packages');
      }
      process.exit(1);
    }
  } else {
    console.log('DATABASE_URL not set, skipping migrations');
  }

  const server = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024, // 50MB for large images
    // Trust proxy headers (X-Forwarded-*) when behind reverse proxy (Caddy, Railway, etc.)
    trustProxy: true,
  });

  // Global error handler to ensure consistent API response format
  server.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      ok: false,
      error: error.message || 'Internal Server Error',
    });
  });

  // Initialize Firebase Admin SDK (only when AUTH_ENABLED=true)
  initializeFirebase();

  // Register authentication middleware
  // When AUTH_ENABLED=true: Requires Firebase token for /api routes
  // When AUTH_ENABLED=false: Uses default anonymous user
  registerAuthMiddleware(server);

  if (isAuthEnabled()) {
    console.log('Firebase authentication enabled');
  } else {
    console.log('Authentication disabled - using anonymous user');
  }

  // Only serve static assets outside development (or when explicitly enabled)
  const serveStatic = process.env.NODE_ENV !== 'development' && process.env.SERVE_STATIC !== 'false';
  if (serveStatic) {
    // Serve built frontend assets (SPA) at "/"
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    server.register(fastifyStatic, {
      root: join(__dirname, '../../web/dist'),
    });
  }

  // Simple liveness endpoint for reverse proxy health checks (Caddy, Railway, etc.)
  // Use /api/health for comprehensive health status including database and doc-processor
  server.get('/health', async () => ({ ok: true }));

  // Register API routes under "/api" prefix
  server.register(healthRoutes, { prefix: '/api' });
  server.register(userRoutes, { prefix: '/api' });
  server.register(providersRoutes, { prefix: '/api' });
  server.register(documentsRoutes, { prefix: '/api' });
  server.register(settingsRoutes, { prefix: '/api' });
  server.register(ownerAliasRoutes, { prefix: '/api' });

  // SPA fallback: serve index.html for non-API routes when static is enabled
  server.setNotFoundHandler((req, reply) => {
    if (!req.url.startsWith('/api/') && serveStatic) {
      return reply.sendFile('index.html');
    }
    reply.code(404).send({ ok: false, error: 'Not Found' });
  });

  const port = Number(process.env.OHS_API_PORT ?? process.env.PORT ?? 3001);
  const address = await server.listen({ port, host: '0.0.0.0' });
  console.log(`API listening on ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
