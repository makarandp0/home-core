import type { FastifyPluginAsync } from 'fastify';
import { HealthSchema, type Health } from '@home/types';
import { getDb, sql } from '@home/db';
import { providerList } from '../providers/index.js';

const DOC_PROCESSOR_URL = process.env.DOC_PROCESSOR_URL ?? 'http://localhost:8000';

function redactKey(key: string | undefined): string | null {
  if (!key || key.length < 8) return null;
  const start = key.slice(0, 6);
  const end = key.slice(-4);
  return `${start}...${end}`;
}

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

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (): Promise<Health> => {
    const version = process.env.COMMIT_SHA;

    // Build configuredProviders dynamically from the registry
    const configuredProviders: Record<string, string | null> = {};
    for (const p of providerList) {
      configuredProviders[p.id] = redactKey(process.env[p.envVar]);
    }

    // Fetch doc-processor version and database status in parallel
    const [docProcessorVersion, dbConnected] = await Promise.all([
      getDocProcessorVersion(),
      checkDatabaseConnection(),
    ]);

    const payload = {
      ok: true,
      ...(version ? { version } : {}),
      ...(docProcessorVersion ? { docProcessorVersion } : {}),
      database: { connected: dbConnected },
      configuredProviders,
    };
    return HealthSchema.parse(payload);
  });
};
