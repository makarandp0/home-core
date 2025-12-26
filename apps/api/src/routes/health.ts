import type { FastifyPluginAsync } from 'fastify';
import { mkdir, access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HealthSchema, type Health } from '@home/types';
import { getDb, sql } from '@home/db';

const DOC_PROCESSOR_URL = process.env.HOME_DOC_PROCESSOR_URL ?? 'http://localhost:8000';
const DOCUMENT_STORAGE_PATH = process.env.DOCUMENT_STORAGE_PATH || null;

async function getDocProcessorVersion(): Promise<string | undefined> {
  try {
    const response = await fetch(`${DOC_PROCESSOR_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2s timeout
    });
    if (response.ok) {
      const data = await response.json();
      return data.version;
    }
  } catch {
    // Doc processor not available
  }
  return undefined;
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
  app.get('/health', async (): Promise<Health> => {
    const version = process.env.COMMIT_SHA || 'dev';

    // Fetch doc-processor version, database status, and storage status in parallel
    const [docProcessorVersion, dbConnected, storageStatus] = await Promise.all([
      getDocProcessorVersion(),
      checkDatabaseConnection(),
      checkDocumentStorage(),
    ]);

    const payload = {
      ok: true,
      version,
      ...(docProcessorVersion ? { docProcessorVersion } : {}),
      docProcessorUrl: DOC_PROCESSOR_URL,
      database: { connected: dbConnected },
      documentStorage: storageStatus,
    };
    return HealthSchema.parse(payload);
  });
};
