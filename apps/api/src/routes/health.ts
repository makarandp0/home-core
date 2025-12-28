import type { FastifyPluginAsync } from 'fastify';
import { mkdir, access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  HealthSchema,
  LoadFaceModelRequestSchema,
  LoadFaceModelResponseSchema,
  type Health,
  type DocProcessorStatus,
  type LoadFaceModelRequest,
  type LoadFaceModelResponse,
} from '@home/types';
import { getDb, sql } from '@home/db';
import { createRouteBuilder } from '../utils/route-builder.js';

const DOC_PROCESSOR_URL = process.env.HOME_DOC_PROCESSOR_URL ?? 'http://localhost:8000';
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || null;

interface DocProcessorHealthResponse {
  ok: boolean;
  version?: string;
  face_model_loaded?: boolean;
  face_model?: string | null;
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
        faceModel: {
          loaded: data.face_model_loaded ?? false,
          model: data.face_model ?? null,
        },
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

      const payload = {
        ok: true,
        version,
        docProcessor,
        database: { connected: dbConnected },
        documentStorage: storageStatus,
      };
      return HealthSchema.parse(payload);
    },
  });

  // Keep this route using raw fastify since LoadFaceModelResponse has its own ok/error format
  app.post<{ Body: LoadFaceModelRequest }>(
    '/doc-processor/load-model',
    async (request): Promise<LoadFaceModelResponse> => {
      const parsed = LoadFaceModelRequestSchema.parse(request.body ?? {});
      try {
        const response = await fetch(`${DOC_PROCESSOR_URL}/face/load-model`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: parsed.model }),
          signal: AbortSignal.timeout(120000), // 2 minute timeout for model download
        });
        const data = await response.json();
        return LoadFaceModelResponseSchema.parse(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { ok: false, error: `Failed to load model: ${message}` };
      }
    }
  );
};
