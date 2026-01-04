// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { FastifyPluginAsync } from 'fastify';
import { mkdir, access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  HealthSchema,
  type Health,
  type DocProcessorStatus,
} from '@ohs/types';
import { getDb, sql } from '@ohs/db';
import { createRouteBuilder } from '../utils/route-builder.js';
import { isAuthEnabled, getFirebaseClientConfig } from '../services/firebase-admin.js';
import { getDefaultUser } from '../middleware/auth.js';

const DOC_PROCESSOR_URL = process.env.OHS_DOC_PROCESSOR_URL ?? 'http://localhost:8000';
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || null;

interface DocProcessorHealthResponse {
  ok: boolean;
  version?: string;
}

async function getDocProcessorStatus(): Promise<DocProcessorStatus> {
  try {
    const response = await fetch(`${DOC_PROCESSOR_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2s timeout
    });
    if (response.ok) {
      const data: DocProcessorHealthResponse = await response.json();
      return {
        available: true,
        version: data.version,
        url: DOC_PROCESSOR_URL,
      };
    }
  } catch {
    // Doc processor not available
  }
  return {
    available: false,
    url: DOC_PROCESSOR_URL,
  };
}

async function checkDatabaseConnection(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

async function checkDocumentStorage(): Promise<{ path: string | null; accessible: boolean; error?: string }> {
  if (!DOCUMENT_STORAGE_PATH) {
    return { path: null, accessible: false, error: 'DOCUMENT_STORAGE_PATH not configured' };
  }
  const absolutePath = resolve(DOCUMENT_STORAGE_PATH);
  try {
    // Try to create the directory (recursive, no error if exists)
    await mkdir(absolutePath, { recursive: true });
    // Check if we have write access
    await access(absolutePath, constants.W_OK);
    return { path: absolutePath, accessible: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { path: absolutePath, accessible: false, error: message };
  }
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  const routes = createRouteBuilder(app);

  routes.get<unknown, unknown, unknown, Health>({
    url: '/health',
    handler: async () => {
      const version = process.env.COMMIT_SHA || 'dev';

      // Fetch doc-processor status, database status, and storage status in parallel
      const [docProcessor, dbConnected, storageStatus] = await Promise.all([
        getDocProcessorStatus(),
        checkDatabaseConnection(),
        checkDocumentStorage(),
      ]);

      const authEnabled = isAuthEnabled();
      const firebaseConfig = authEnabled ? getFirebaseClientConfig() : null;
      const defaultUser = !authEnabled ? getDefaultUser() : null;

      const payload = {
        ok: true,
        version,
        docProcessor,
        database: { connected: dbConnected },
        documentStorage: storageStatus,
        auth: {
          enabled: authEnabled,
          ...(firebaseConfig && { firebase: firebaseConfig }),
          ...(defaultUser && {
            defaultUser: {
              id: defaultUser.id,
              email: defaultUser.email,
              displayName: defaultUser.displayName,
              photoURL: defaultUser.photoUrl,
            },
          }),
        },
      };
      return HealthSchema.parse(payload);
    },
  });
};
