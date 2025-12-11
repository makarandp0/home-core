import Fastify from 'fastify';

const server = Fastify({ logger: true });

server.get('/health', async () => ({ ok: true }));

server.get('/', async () => ({ message: 'Hello from @home/api' }));

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
