import type { FastifyPluginAsync } from 'fastify';
import { HealthSchema, type Health } from '@home/types';

function redactKey(key: string | undefined): string | null {
  if (!key || key.length < 8) return null;
  const start = key.slice(0, 6);
  const end = key.slice(-4);
  return `${start}...${end}`;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (): Promise<Health> => {
    const version = process.env.COMMIT_SHA;
    const configuredProviders = {
      anthropic: redactKey(process.env.ANTHROPIC_API_KEY),
      openai: redactKey(process.env.OPENAI_API_KEY),
    };
    const payload = {
      ok: true,
      ...(version ? { version } : {}),
      configuredProviders,
    };
    return HealthSchema.parse(payload);
  });
};
