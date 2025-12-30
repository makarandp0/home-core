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
} from '@home/types';
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

  // GET /api/settings/owner-aliases - List all aliases
  routes.get<unknown, unknown, unknown, OwnerAliasListResponse>({
    url: '/settings/owner-aliases',
    handler: async () => {
      const aliases = await getOwnerAliases();
      return { aliases, total: aliases.length };
    },
  });

  // POST /api/settings/owner-aliases - Create alias
  routes.post<OwnerAliasCreate, unknown, unknown, OwnerAlias>({
    url: '/settings/owner-aliases',
    schema: { body: OwnerAliasCreateSchema },
    handler: async ({ body }) => {
      return await createOwnerAlias(body);
    },
  });

  // PUT /api/settings/owner-aliases/:id - Update alias
  routes.put<OwnerAliasUpdate, IdParams, unknown, OwnerAlias>({
    url: '/settings/owner-aliases/:id',
    schema: {
      body: OwnerAliasUpdateSchema,
      params: IdParamsSchema,
    },
    handler: async ({ body, params }) => {
      const alias = await updateOwnerAlias(params.id, body);
      if (!alias) {
        notFound('Owner alias not found');
      }
      return alias;
    },
  });

  // DELETE /api/settings/owner-aliases/:id - Delete alias
  routes.delete<unknown, IdParams, unknown, { deleted: boolean }>({
    url: '/settings/owner-aliases/:id',
    schema: { params: IdParamsSchema },
    handler: async ({ params }) => {
      const deleted = await deleteOwnerAlias(params.id);
      if (!deleted) {
        notFound('Owner alias not found');
      }
      return { deleted: true };
    },
  });

  // POST /api/settings/owner-aliases/apply - Retroactive batch update
  routes.post<unknown, unknown, unknown, OwnerAliasBatchApplyResponse>({
    url: '/settings/owner-aliases/apply',
    handler: async () => {
      return await applyAliasesRetroactively();
    },
  });

  // GET /api/settings/owner-names - Get suggested owner names for autocomplete
  routes.get<unknown, unknown, unknown, SuggestedOwnerNamesResponse>({
    url: '/settings/owner-names',
    handler: async () => {
      return await getSuggestedOwnerNames();
    },
  });
};
