// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getFirebaseAuth, isAuthEnabled } from '../services/firebase-admin.js';
import { getDb, users, eq } from '@home/db';

// Fixed UUID for the default anonymous user (must match migration)
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface AuthenticatedUser {
  id: string; // Internal UUID
  firebaseUid: string; // Firebase UID
  email: string;
  displayName: string | null;
  photoUrl: string | null;
}

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

/**
 * Get the default anonymous user for when auth is disabled
 */
function getDefaultUser(): AuthenticatedUser {
  return {
    id: DEFAULT_USER_ID,
    firebaseUid: 'anonymous',
    email: 'anonymous@local',
    displayName: 'Local User',
    photoUrl: null,
  };
}

/**
 * Authentication middleware
 * - When AUTH_ENABLED=false: Attaches default anonymous user
 * - When AUTH_ENABLED=true: Verifies Firebase token and looks up/creates user
 */
async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // If auth is disabled, use default user
  if (!isAuthEnabled()) {
    request.user = getDefaultUser();
    return;
  }

  // Auth is enabled - require Bearer token
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({
      ok: false,
      error: 'Missing or invalid authorization header',
    });
    return;
  }

  const idToken = authHeader.substring(7);

  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    // Get or create user in local database
    const db = getDb();
    let [user] = await db.select().from(users).where(eq(users.firebaseUid, decodedToken.uid)).limit(1);

    if (!user) {
      // First-time login: create user record
      [user] = await db
        .insert(users)
        .values({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email ?? '',
          displayName: decodedToken.name ?? null,
          photoUrl: decodedToken.picture ?? null,
          provider: decodedToken.firebase.sign_in_provider,
          lastLoginAt: new Date().toISOString(),
        })
        .returning();
    } else {
      // Update last login time
      await db
        .update(users)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(users.id, user.id));
    }

    request.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
    };
  } catch (err) {
    request.log.error({ err }, 'Firebase token verification failed');
    reply.code(401).send({
      ok: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Register authentication middleware on the Fastify instance
 * Applies to all /api routes except public endpoints like /health
 */
export function registerAuthMiddleware(app: FastifyInstance): void {
  const publicPaths = ['/health', '/api/health'];

  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for public paths
    if (publicPaths.includes(request.url)) {
      return;
    }

    // Apply auth to all /api routes
    if (request.url.startsWith('/api/')) {
      await authMiddleware(request, reply);
    }
  });
}
