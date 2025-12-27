import Fastify from 'fastify';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import fastifyStatic from '@fastify/static';
import { healthRoutes } from './routes/health.js';
import { userRoutes } from './routes/user.js';
import { visionRoutes } from './routes/vision.js';
import { providersRoutes } from './routes/providers.js';
import { documentsRoutes } from './routes/documents.js';
import { settingsRoutes } from './routes/settings.js';

// Run database migrations on startup
// TODO: Consider using Railway's release command instead for production deployments
// TODO: With multiple replicas, concurrent migrations could cause issues - consider using advisory locks
// TODO: This blocks server startup - for large migrations, use a separate migration job
if (process.env.DATABASE_URL) {
  try {
    console.log('Running database migrations...');
    // Use migrate:up:prod in production (no dotenv wrapper needed since DATABASE_URL is already set)
    const script = process.env.NODE_ENV === 'production' ? 'migrate:up:prod' : 'migrate:up';
    execSync(`pnpm --filter @home/db ${script}`, { stdio: 'inherit' });
    console.log('Migrations complete');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

const server = Fastify({
  logger: true,
  bodyLimit: 50 * 1024 * 1024, // 50MB for large images
});

// Global error handler to ensure consistent API response format
server.setErrorHandler((error, _request, reply) => {
  const statusCode = error.statusCode ?? 500;
  reply.code(statusCode).send({
    ok: false,
    error: error.message || 'Internal Server Error',
  });
});

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

// Register API routes under "/api" prefix
server.register(healthRoutes, { prefix: '/api' });
server.register(userRoutes, { prefix: '/api' });
server.register(visionRoutes, { prefix: '/api' });
server.register(providersRoutes, { prefix: '/api' });
server.register(documentsRoutes, { prefix: '/api' });
server.register(settingsRoutes, { prefix: '/api' });

// SPA fallback: serve index.html for non-API routes when static is enabled
server.setNotFoundHandler((req, reply) => {
  if (!req.url.startsWith('/api/') && serveStatic) {
    return reply.sendFile('index.html');
  }
  reply.code(404).send({ ok: false, error: 'Not Found' });
});

const port = Number(process.env.HOME_API_PORT ?? process.env.PORT ?? 3001);
server
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    console.log(`API listening on ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
