// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyPluginAsync } from 'fastify';
import {
  OwnerAliasCreateSchema,
  OwnerAliasUpdateSchema,
  IdParamsSchema,
  type OwnerAlias,
  type OwnerAliasListResponse,
  type OwnerAliasCreate,
  type OwnerAliasUpdate,
  type IdParams,
  type OwnerAliasBatchApplyResponse,
  type SuggestedOwnerNamesResponse,
} from '@ohs/types';
import {
  getOwnerAliases,
  createOwnerAlias,
  updateOwnerAlias,
  deleteOwnerAlias,
  applyAliasesRetroactively,
  getSuggestedOwnerNames,
} from '../services/owner-alias-service.js';
import { createRouteBuilder, notFound } from '../utils/route-builder.js';

export const ownerAliasRoutes: FastifyPluginAsync = async (app) => {
  const routes = createRouteBuilder(app);

  // GET /api/settings/owner-aliases - List all aliases for the authenticated user
  routes.get<unknown, unknown, unknown, OwnerAliasListResponse>({
    url: '/settings/owner-aliases',
    handler: async ({ request }) => {
      const aliases = await getOwnerAliases(request.user.id);
      return { aliases, total: aliases.length };
    },
  });

  // POST /api/settings/owner-aliases - Create alias for the authenticated user
  routes.post<OwnerAliasCreate, unknown, unknown, OwnerAlias>({
    url: '/settings/owner-aliases',
    schema: { body: OwnerAliasCreateSchema },
    handler: async ({ body, request }) => {
      return await createOwnerAlias(body, request.user.id);
    },
  });

  // PUT /api/settings/owner-aliases/:id - Update alias for the authenticated user
  routes.put<OwnerAliasUpdate, IdParams, unknown, OwnerAlias>({
    url: '/settings/owner-aliases/:id',
    schema: {
      body: OwnerAliasUpdateSchema,
      params: IdParamsSchema,
    },
    handler: async ({ body, params, request }) => {
      const alias = await updateOwnerAlias(params.id, body, request.user.id);
      if (!alias) {
        notFound('Owner alias not found');
      }
      return alias;
    },
  });

  // DELETE /api/settings/owner-aliases/:id - Delete alias for the authenticated user
  routes.delete<unknown, IdParams, unknown, { deleted: boolean }>({
    url: '/settings/owner-aliases/:id',
    schema: { params: IdParamsSchema },
    handler: async ({ params, request }) => {
      const deleted = await deleteOwnerAlias(params.id, request.user.id);
      if (!deleted) {
        notFound('Owner alias not found');
      }
      return { deleted: true };
    },
  });

  // POST /api/settings/owner-aliases/apply - Retroactive batch update for the authenticated user
  routes.post<unknown, unknown, unknown, OwnerAliasBatchApplyResponse>({
    url: '/settings/owner-aliases/apply',
    handler: async ({ request }) => {
      return await applyAliasesRetroactively(request.user.id);
    },
  });

  // GET /api/settings/owner-names - Get suggested owner names for autocomplete for the authenticated user
  routes.get<unknown, unknown, unknown, SuggestedOwnerNamesResponse>({
    url: '/settings/owner-names',
    handler: async ({ request }) => {
      return await getSuggestedOwnerNames(request.user.id);
    },
  });
};
