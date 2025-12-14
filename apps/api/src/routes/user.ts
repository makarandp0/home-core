import type { FastifyPluginAsync } from 'fastify';
import { UserSchema, type User, type ApiResponse } from '@home/types';

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/user', async (): Promise<ApiResponse<User>> => {
    const parsed = UserSchema.parse({
      id: 'u_1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
    return { ok: true, data: parsed };
  });
};
