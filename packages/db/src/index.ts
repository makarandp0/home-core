export { createDb, getDb } from './client.js';
export type { Database } from './client.js';

// Re-export schema for convenience
export * from './schema/index.js';

// Re-export drizzle utilities that consumers might need
export { eq, ne, gt, gte, lt, lte, and, or, like, ilike, inArray, notInArray, isNull, isNotNull, sql, desc, asc } from 'drizzle-orm';
