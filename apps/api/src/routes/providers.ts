import type { FastifyPluginAsync } from 'fastify';
import { type ApiResponse, type ProvidersResponse } from '@home/types';
import { providerList } from '../providers/index.js';

export const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/providers', async (): Promise<ApiResponse<ProvidersResponse>> => {
    const providers = providerList.map((p) => ({
      id: p.id,
      label: p.label,
      placeholder: p.placeholder,
    }));

    return {
      ok: true,
      data: { providers },
    };
  });
};
