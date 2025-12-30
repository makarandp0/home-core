// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { getDb, providerConfigs, eq } from '@home/db';
import type { ProviderId, ProviderConfig, ProviderConfigCreate, ProviderConfigUpdate } from '@home/types';
import { ProviderIdSchema } from '@home/types';

/**
 * Redact an API key for display.
 * Shows first 4 chars, and last 4 chars only if the key is long enough.
 */
function redactKey(key: string): string {
  if (!key) return '***';

  const visiblePrefixLength = 4;
  const visibleSuffixLength = 4;
  const minLengthForSuffix = visiblePrefixLength + visibleSuffixLength + 4;

  const prefix = key.slice(0, visiblePrefixLength);

  if (key.length < minLengthForSuffix) {
    return `${prefix}...****`;
  }

  const suffix = key.slice(-visibleSuffixLength);
  return `${prefix}...${suffix}`;
}

/**
 * Parse a provider type string to a validated ProviderId.
 */
function parseProviderId(value: string): ProviderId {
  const result = ProviderIdSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid provider type: ${value}`);
  }
  return result.data;
}

/**
 * Convert a DB row to a ProviderConfig (with redacted key).
 */
function toProviderConfig(row: {
  id: string;
  name: string;
  providerType: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}): ProviderConfig {
  return {
    id: row.id,
    name: row.name,
    providerType: parseProviderId(row.providerType),
    apiKeyRedacted: redactKey(row.apiKey),
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get all provider configurations (with redacted keys).
 */
export async function getProviderConfigs(): Promise<ProviderConfig[]> {
  const db = getDb();
  const rows = await db.select().from(providerConfigs).orderBy(providerConfigs.createdAt);
  return rows.map(toProviderConfig);
}

/**
 * Get the active provider configuration.
 */
export async function getActiveProvider(): Promise<ProviderConfig | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.isActive, true))
    .limit(1);
  return row ? toProviderConfig(row) : null;
}

/**
 * Get the API key for a specific provider type (from active provider).
 * Used internally by vision routes.
 */
export async function getApiKey(providerType: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.isActive, true))
    .limit(1);

  if (!row) return null;
  if (row.providerType !== providerType) return null;
  return row.apiKey;
}

/**
 * Get the API key for a specific provider type, regardless of active status.
 * Useful for CLI scripts that specify a provider explicitly.
 */
export async function getApiKeyForProvider(providerType: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.providerType, providerType))
    .limit(1);

  return row?.apiKey ?? null;
}

/**
 * Get the active provider's API key regardless of provider type.
 * Returns both the key and the provider type.
 */
export async function getActiveApiKey(): Promise<{ apiKey: string; providerType: string } | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.isActive, true))
    .limit(1);

  if (!row) return null;
  return { apiKey: row.apiKey, providerType: row.providerType };
}

/**
 * Create a new provider configuration.
 */
export async function createProviderConfig(data: ProviderConfigCreate): Promise<ProviderConfig> {
  const db = getDb();
  const now = new Date().toISOString();

  const [row] = await db
    .insert(providerConfigs)
    .values({
      name: data.name,
      providerType: data.providerType,
      apiKey: data.apiKey,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return toProviderConfig(row);
}

/**
 * Update a provider configuration.
 */
export async function updateProviderConfig(
  id: string,
  data: ProviderConfigUpdate
): Promise<ProviderConfig | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;

  const [row] = await db
    .update(providerConfigs)
    .set(updateData)
    .where(eq(providerConfigs.id, id))
    .returning();

  return row ? toProviderConfig(row) : null;
}

/**
 * Delete a provider configuration.
 */
export async function deleteProviderConfig(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(providerConfigs)
    .where(eq(providerConfigs.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Set a provider as active (deactivates all others).
 * Uses a transaction to ensure atomicity.
 */
export async function setActiveProvider(id: string): Promise<ProviderConfig | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    // First, deactivate all providers
    await tx
      .update(providerConfigs)
      .set({ isActive: false, updatedAt: now });

    // Then, activate the specified provider
    const [row] = await tx
      .update(providerConfigs)
      .set({ isActive: true, updatedAt: now })
      .where(eq(providerConfigs.id, id))
      .returning();

    return row ?? null;
  });

  return result ? toProviderConfig(result) : null;
}

/**
 * Get full settings response (providers + activeProviderId).
 */
export async function getSettingsResponse(): Promise<{
  providers: ProviderConfig[];
  activeProviderId: string | null;
}> {
  const providers = await getProviderConfigs();
  const activeProviderId = providers.find((p) => p.isActive)?.id ?? null;

  return { providers, activeProviderId };
}
