// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyPluginAsync } from 'fastify';
import {
  ProviderConfigCreateSchema,
  ProviderConfigUpdateSchema,
  IdParamsSchema,
  type SettingsResponse,
  type ProviderConfig,
  type ProviderConfigCreate,
  type ProviderConfigUpdate,
  type IdParams,
} from '@home/types';
import {
  getSettingsResponse,
  createProviderConfig,
  updateProviderConfig,
  deleteProviderConfig,
  setActiveProvider,
  getActiveProvider,
} from '../services/settings-service.js';
import { createRouteBuilder, notFound, badRequest } from '../utils/route-builder.js';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  const routes = createRouteBuilder(app);

  // GET /api/settings - Get all settings (providers + active)
  routes.get<unknown, unknown, unknown, SettingsResponse>({
    url: '/settings',
    handler: async () => {
      return await getSettingsResponse();
    },
  });

  // POST /api/settings/providers - Create new provider config
  routes.post<ProviderConfigCreate, unknown, unknown, ProviderConfig>({
    url: '/settings/providers',
    schema: { body: ProviderConfigCreateSchema },
    handler: async ({ body }) => {
      return await createProviderConfig(body);
    },
  });

  // PUT /api/settings/providers/:id - Update provider config
  routes.put<ProviderConfigUpdate, IdParams, unknown, ProviderConfig>({
    url: '/settings/providers/:id',
    schema: {
      body: ProviderConfigUpdateSchema,
      params: IdParamsSchema,
    },
    handler: async ({ body, params }) => {
      const provider = await updateProviderConfig(params.id, body);
      if (!provider) {
        notFound('Provider configuration not found');
      }
      return provider;
    },
  });

  // DELETE /api/settings/providers/:id - Delete provider config
  routes.delete<unknown, IdParams, unknown, { deleted: boolean }>({
    url: '/settings/providers/:id',
    schema: { params: IdParamsSchema },
    handler: async ({ params }) => {
      // Prevent deleting the active provider if there are other providers to switch to
      const activeProvider = await getActiveProvider();
      if (activeProvider && activeProvider.id === params.id) {
        const settings = await getSettingsResponse();
        if (settings.providers.length > 1) {
          badRequest('Cannot delete the active provider. Please activate another provider first.');
        }
      }

      const deleted = await deleteProviderConfig(params.id);
      if (!deleted) {
        notFound('Provider configuration not found');
      }

      return { deleted: true };
    },
  });

  // POST /api/settings/providers/:id/activate - Set provider as active
  routes.post<unknown, IdParams, unknown, ProviderConfig>({
    url: '/settings/providers/:id/activate',
    schema: { params: IdParamsSchema },
    handler: async ({ params }) => {
      const provider = await setActiveProvider(params.id);
      if (!provider) {
        notFound('Provider configuration not found');
      }
      return provider;
    },
  });
};
