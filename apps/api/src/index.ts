import Fastify from 'fastify';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { UserSchema, type User, type ApiResponse } from '@home/types';

const server = Fastify({ logger: true });

// Only serve static assets outside development (or when explicitly enabled)
const serveStatic = process.env.NODE_ENV !== 'development' && process.env.SERVE_STATIC !== 'false';
if (serveStatic) {
  // Serve built frontend assets (SPA) at "/"
  server.register(fastifyStatic, {
    root: join(__dirname, '../../web/dist'),
  });
}

// Register API routes under "/api" prefix
server.register(
  (app, _opts, done) => {
    app.get('/health', async () => ({ ok: true }));

    // Example route using shared Zod schema
    app.get('/user', async (): Promise<ApiResponse<User>> => {
      const parsed = UserSchema.parse({
        id: 'u_1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      });
      return { ok: true, data: parsed };
    });

    done();
  },
  { prefix: '/api' },
);

// SPA fallback: serve index.html for non-API routes when static is enabled
server.setNotFoundHandler((req, reply) => {
  if (!req.url.startsWith('/api/') && serveStatic) {
    return reply.sendFile('index.html');
  }
  reply.code(404).send({ ok: false, error: 'Not Found' });
});

const port = Number(process.env.PORT ?? 3001);
server
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    console.log(`API listening on ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
