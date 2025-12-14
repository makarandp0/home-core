import type { FastifyPluginAsync } from 'fastify';
import { HealthSchema, type Health } from '@home/types';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (): Promise<Health> => {
    const parsed = HealthSchema.parse({ ok: true });
    return parsed;
  });
};
