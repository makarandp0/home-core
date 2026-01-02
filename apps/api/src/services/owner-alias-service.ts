// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { getDb, ownerNameAliases, documents, eq, ilike, sql, isNotNull, and } from '@home/db';
import type { OwnerAlias, OwnerAliasCreate, OwnerAliasUpdate, OwnerAliasBatchApplyResponse, SuggestedOwnerNamesResponse } from '@home/types';

/**
 * Validate that a string is a valid regex pattern.
 * Throws an error with a descriptive message if invalid.
 */
function validateRegexPattern(pattern: string): void {
  try {
    new RegExp(pattern);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Invalid regex';
    throw new Error(`Invalid regex pattern: ${message}`);
  }
}

/**
 * Convert a DB row to an OwnerAlias.
 */
function toOwnerAlias(row: {
  id: string;
  aliasName: string;
  canonicalName: string;
  createdAt: string;
  updatedAt: string;
}): OwnerAlias {
  return {
    id: row.id,
    aliasName: row.aliasName,
    canonicalName: row.canonicalName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get all owner name aliases for a user.
 */
export async function getOwnerAliases(userId: string): Promise<OwnerAlias[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(ownerNameAliases)
    .where(eq(ownerNameAliases.userId, userId))
    .orderBy(ownerNameAliases.aliasName);
  return rows.map(toOwnerAlias);
}

/**
 * Get an owner alias by ID for a user.
 */
export async function getOwnerAliasById(id: string, userId: string): Promise<OwnerAlias | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(ownerNameAliases)
    .where(and(eq(ownerNameAliases.id, id), eq(ownerNameAliases.userId, userId)))
    .limit(1);
  return row ? toOwnerAlias(row) : null;
}

/**
 * Create a new owner alias for a user.
 * The aliasName is treated as a regex pattern.
 */
export async function createOwnerAlias(data: OwnerAliasCreate, userId: string): Promise<OwnerAlias> {
  const db = getDb();
  const now = new Date().toISOString();

  // Validate the regex pattern
  const pattern = data.aliasName.trim();
  validateRegexPattern(pattern);

  const [row] = await db
    .insert(ownerNameAliases)
    .values({
      aliasName: pattern,
      canonicalName: data.canonicalName.trim(),
      userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toOwnerAlias(row);
}

/**
 * Update an existing owner alias for a user.
 * The aliasName is treated as a regex pattern.
 */
export async function updateOwnerAlias(
  id: string,
  data: OwnerAliasUpdate,
  userId: string
): Promise<OwnerAlias | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { updatedAt: now };
  if (data.aliasName !== undefined) {
    const pattern = data.aliasName.trim();
    validateRegexPattern(pattern);
    updateData.aliasName = pattern;
  }
  if (data.canonicalName !== undefined) updateData.canonicalName = data.canonicalName.trim();

  const [row] = await db
    .update(ownerNameAliases)
    .set(updateData)
    .where(and(eq(ownerNameAliases.id, id), eq(ownerNameAliases.userId, userId)))
    .returning();

  return row ? toOwnerAlias(row) : null;
}

/**
 * Delete an owner alias for a user.
 */
export async function deleteOwnerAlias(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(ownerNameAliases)
    .where(and(eq(ownerNameAliases.id, id), eq(ownerNameAliases.userId, userId)))
    .returning();

  return result.length > 0;
}

/**
 * Resolve an owner name to its canonical form (if alias exists) for a user.
 * Used during document upload and update.
 * Returns the canonical name if a matching alias is found (case-insensitive),
 * otherwise returns the original name.
 */
export async function resolveOwnerName(name: string | null | undefined, userId: string): Promise<string | null | undefined> {
  if (name == null) return name;

  const db = getDb();
  const trimmedName = name.trim();

  // Case-insensitive lookup for this user
  const [alias] = await db
    .select({ canonicalName: ownerNameAliases.canonicalName })
    .from(ownerNameAliases)
    .where(and(ilike(ownerNameAliases.aliasName, trimmedName), eq(ownerNameAliases.userId, userId)))
    .limit(1);

  return alias?.canonicalName ?? trimmedName;
}

/**
 * Apply all aliases retroactively to existing documents for a user.
 * For each alias, updates all documents where documentOwner matches the alias pattern (regex, case-insensitive).
 * Returns the count of updated documents per alias.
 */
export async function applyAliasesRetroactively(userId: string): Promise<OwnerAliasBatchApplyResponse> {
  const db = getDb();

  // Get all aliases for this user
  const aliases = await db
    .select()
    .from(ownerNameAliases)
    .where(eq(ownerNameAliases.userId, userId));

  let totalUpdated = 0;
  const results: OwnerAliasBatchApplyResponse['aliases'] = [];

  for (const alias of aliases) {
    // Update documents where documentOwner matches alias pattern (case-insensitive regex) for this user
    // Using PostgreSQL's ~* operator for case-insensitive regex matching
    const updated = await db
      .update(documents)
      .set({
        documentOwner: alias.canonicalName,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        sql`${documents.documentOwner} ~* ${alias.aliasName}`,
        eq(documents.userId, userId)
      ))
      .returning({ id: documents.id });

    totalUpdated += updated.length;
    results.push({
      aliasName: alias.aliasName,
      canonicalName: alias.canonicalName,
      matchedDocuments: updated.length,
    });
  }

  return {
    updatedCount: totalUpdated,
    aliases: results,
  };
}

/**
 * Get suggested owner names for autocomplete for a user.
 * Combines canonical names from aliases table with unique owner names from documents.
 * Document owners that match an alias pattern are excluded (the canonical name is suggested instead).
 */
export async function getSuggestedOwnerNames(userId: string): Promise<SuggestedOwnerNamesResponse> {
  const db = getDb();

  // Get all aliases for this user (pattern + canonical)
  const aliasRows = await db
    .select()
    .from(ownerNameAliases)
    .where(eq(ownerNameAliases.userId, userId));

  // Build regex patterns for matching
  const aliasPatterns: { regex: RegExp; canonicalName: string }[] = [];
  for (const alias of aliasRows) {
    try {
      aliasPatterns.push({
        regex: new RegExp(alias.aliasName, 'i'),
        canonicalName: alias.canonicalName,
      });
    } catch (e) {
      // Log invalid regex patterns so they're not silently ignored
      const message = e instanceof Error ? e.message : 'Unknown error';
      console.warn(
        `Skipping invalid owner alias regex pattern "${alias.aliasName}" for canonical name "${alias.canonicalName}": ${message}`
      );
    }
  }

  const canonicalNames = new Set(aliasRows.map(r => r.canonicalName));

  // Get unique owner names from documents for this user with counts
  const documentOwnerRows = await db
    .select({
      documentOwner: documents.documentOwner,
      count: sql<number>`count(*)::int`,
    })
    .from(documents)
    .where(and(isNotNull(documents.documentOwner), eq(documents.userId, userId)))
    .groupBy(documents.documentOwner)
    .orderBy(sql`count(*) desc`);

  // Build the response, merging canonical and document owners
  const namesMap = new Map<string, { name: string; isCanonical: boolean; documentCount?: number }>();

  // Add canonical names first
  for (const name of canonicalNames) {
    namesMap.set(name.toLowerCase(), { name, isCanonical: true });
  }

  // Add/merge document owners (skip those that match an alias pattern)
  for (const row of documentOwnerRows) {
    if (!row.documentOwner) continue;

    const key = row.documentOwner.toLowerCase();
    const existing = namesMap.get(key);

    if (existing) {
      // Update with document count
      existing.documentCount = row.count;
    } else {
      // Check if this owner matches any alias pattern
      const matchesPattern = aliasPatterns.some(({ regex, canonicalName }) => {
        // If it matches the pattern but is not the canonical name, skip it
        return regex.test(row.documentOwner!) &&
               row.documentOwner!.toLowerCase() !== canonicalName.toLowerCase();
      });

      if (!matchesPattern) {
        // New name from documents that doesn't match any pattern
        namesMap.set(key, {
          name: row.documentOwner,
          isCanonical: false,
          documentCount: row.count,
        });
      }
    }
  }

  // Sort: canonical first, then by document count, then alphabetically
  const names = Array.from(namesMap.values()).sort((a, b) => {
    if (a.isCanonical !== b.isCanonical) return a.isCanonical ? -1 : 1;
    if ((a.documentCount ?? 0) !== (b.documentCount ?? 0)) return (b.documentCount ?? 0) - (a.documentCount ?? 0);
    return a.name.localeCompare(b.name);
  });

  return { names };
}
