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
} from '@ohs/types';
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

  // GET /api/settings - Get all settings for the authenticated user (providers + active)
  routes.get<unknown, unknown, unknown, SettingsResponse>({
    url: '/settings',
    handler: async ({ request }) => {
      return await getSettingsResponse(request.user.id);
    },
  });

  // POST /api/settings/providers - Create new provider config for the authenticated user
  routes.post<ProviderConfigCreate, unknown, unknown, ProviderConfig>({
    url: '/settings/providers',
    schema: { body: ProviderConfigCreateSchema },
    handler: async ({ body, request }) => {
      return await createProviderConfig(body, request.user.id);
    },
  });

  // PUT /api/settings/providers/:id - Update provider config for the authenticated user
  routes.put<ProviderConfigUpdate, IdParams, unknown, ProviderConfig>({
    url: '/settings/providers/:id',
    schema: {
      body: ProviderConfigUpdateSchema,
      params: IdParamsSchema,
    },
    handler: async ({ body, params, request }) => {
      const provider = await updateProviderConfig(params.id, body, request.user.id);
      if (!provider) {
        notFound('Provider configuration not found');
      }
      return provider;
    },
  });

  // DELETE /api/settings/providers/:id - Delete provider config for the authenticated user
  routes.delete<unknown, IdParams, unknown, { deleted: boolean }>({
    url: '/settings/providers/:id',
    schema: { params: IdParamsSchema },
    handler: async ({ params, request }) => {
      // Prevent deleting the active provider if there are other providers to switch to
      const activeProvider = await getActiveProvider(request.user.id);
      if (activeProvider && activeProvider.id === params.id) {
        const settings = await getSettingsResponse(request.user.id);
        if (settings.providers.length > 1) {
          badRequest('Cannot delete the active provider. Please activate another provider first.');
        }
      }

      const deleted = await deleteProviderConfig(params.id, request.user.id);
      if (!deleted) {
        notFound('Provider configuration not found');
      }

      return { deleted: true };
    },
  });

  // POST /api/settings/providers/:id/activate - Set provider as active for the authenticated user
  routes.post<unknown, IdParams, unknown, ProviderConfig>({
    url: '/settings/providers/:id/activate',
    schema: { params: IdParamsSchema },
    handler: async ({ params, request }) => {
      const provider = await setActiveProvider(params.id, request.user.id);
      if (!provider) {
        notFound('Provider configuration not found');
      }
      return provider;
    },
  });
};
