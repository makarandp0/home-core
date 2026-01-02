// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyPluginAsync } from 'fastify';
import { UserSchema, type User } from '@home/types';
import { createRouteBuilder } from '../utils/route-builder.js';

export const userRoutes: FastifyPluginAsync = async (app) => {
  const routes = createRouteBuilder(app);

  routes.get<unknown, unknown, unknown, User>({
    url: '/user',
    handler: async ({ request }) => {
      // Return the authenticated user from the auth middleware
      return UserSchema.parse({
        id: request.user.id,
        name: request.user.displayName ?? 'User',
        email: request.user.email,
      });
    },
  });
};
