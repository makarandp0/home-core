import type { FastifyPluginAsync } from 'fastify';
import { type ProvidersResponse } from '@home/types';
import { providerList } from '../providers/index.js';
import { createRouteBuilder } from '../utils/route-builder.js';

export const providersRoutes: FastifyPluginAsync = async (app) => {
  const routes = createRouteBuilder(app);

  routes.get<unknown, unknown, unknown, ProvidersResponse>({
    url: '/providers',
    handler: async () => {
      const providers = providerList.map((p) => ({
        id: p.id,
        label: p.label,
        placeholder: p.placeholder,
      }));

      return { providers };
    },
  });
};
