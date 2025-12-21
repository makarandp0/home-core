import type { FastifyPluginAsync } from 'fastify';
import { HealthSchema, type Health } from '@home/types';
import { providerList } from '../providers/index.js';

function redactKey(key: string | undefined): string | null {
  if (!key || key.length < 8) return null;
  const start = key.slice(0, 6);
  const end = key.slice(-4);
  return `${start}...${end}`;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (): Promise<Health> => {
    const version = process.env.COMMIT_SHA;

    // Build configuredProviders dynamically from the registry
    const configuredProviders = Object.fromEntries(
      providerList.map((p) => [p.id, redactKey(process.env[p.envVar])])
    ) as Record<string, string | null>;

    const payload = {
      ok: true,
      ...(version ? { version } : {}),
      configuredProviders,
    };
    return HealthSchema.parse(payload);
  });
};
