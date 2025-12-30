// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema/index.js';

const { Pool } = pg;

export type Database = ReturnType<typeof createDb>;

export function createDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
  });

  return drizzle(pool, { schema });
}

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    db = createDb(connectionString);
  }
  return db;
}
