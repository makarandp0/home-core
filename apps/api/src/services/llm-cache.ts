// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { getDb, llmCache, eq } from '@ohs/db';
import type { ExtractTextResult, ParseTextResult, VisionResult } from '../providers/types.js';

export type CacheableOperation = 'extract_text' | 'parse_text' | 'analyze';

export type CacheableResult = ExtractTextResult | ParseTextResult | VisionResult;

/**
 * Type guard to validate cached response data structure.
 */
function isCacheableResult(data: unknown): data is CacheableResult {
  if (data === null || typeof data !== 'object') return false;
  if (!('usage' in data) || data.usage === null || typeof data.usage !== 'object') return false;
  const usage = data.usage;
  return (
    'promptTokens' in usage &&
    'completionTokens' in usage &&
    'totalTokens' in usage &&
    typeof usage.promptTokens === 'number' &&
    typeof usage.completionTokens === 'number' &&
    typeof usage.totalTokens === 'number'
  );
}


/**
 * Generate a cache key from the operation parameters.
 * Uses SHA-256 hash of: operation_type + provider + input_data + prompt
 */
export function generateCacheKey(
  operation: CacheableOperation,
  provider: string,
  inputData: string,
  prompt: string = ''
): string {
  const content = `${operation}:${provider}:${inputData}:${prompt}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get a cached LLM response if it exists.
 * Returns the raw responseData which the caller should validate/narrow.
 */
async function getCachedResponse(cacheKey: string): Promise<CacheableResult | null> {
  try {
    const db = getDb();
    const result = await db
      .select()
      .from(llmCache)
      .where(eq(llmCache.cacheKey, cacheKey))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // responseData is stored as jsonb matching CacheableResult structure
    const data: unknown = result[0].responseData;
    if (isCacheableResult(data)) {
      return data;
    }
    return null;
  } catch (err) {
    // Log but don't fail - cache miss is acceptable
    console.error('Cache lookup error:', err);
    return null;
  }
}

/**
 * Store an LLM response in the cache.
 */
export async function setCachedResponse(
  cacheKey: string,
  operation: CacheableOperation,
  provider: string,
  response: CacheableResult
): Promise<void> {
  try {
    const db = getDb();
    await db
      .insert(llmCache)
      .values({
        cacheKey,
        operationType: operation,
        provider,
        responseData: response,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      })
      .onConflictDoNothing(); // Don't fail on duplicate cache keys
  } catch (err) {
    // Log but don't fail - cache write failure shouldn't break the request
    console.error('Cache write error:', err);
  }
}

/**
 * Type guards for narrowing CacheableResult to specific types.
 */
function isVisionResult(result: CacheableResult): result is VisionResult {
  return 'extractedText' in result && 'response' in result;
}

function isExtractTextResult(result: CacheableResult): result is ExtractTextResult {
  return 'extractedText' in result && !('response' in result);
}

function isParseTextResult(result: CacheableResult): result is ParseTextResult {
  return 'response' in result && !('extractedText' in result);
}

/**
 * Cache wrapper for analyze operation (VisionResult).
 */
export async function withAnalyzeCache(
  provider: string,
  imageData: string,
  prompt: string,
  llmCall: () => Promise<VisionResult>
): Promise<{ result: VisionResult; cached: boolean }> {
  const cacheKey = generateCacheKey('analyze', provider, imageData, prompt);

  const cached = await getCachedResponse(cacheKey);
  if (cached && isVisionResult(cached)) {
    console.log(`Cache hit for analyze (provider: ${provider})`);
    return { result: cached, cached: true };
  }

  console.log(`Cache miss for analyze (provider: ${provider})`);
  const result = await llmCall();

  setCachedResponse(cacheKey, 'analyze', provider, result).catch(() => {});
  return { result, cached: false };
}

/**
 * Cache wrapper for extract_text operation (ExtractTextResult).
 */
export async function withExtractTextCache(
  provider: string,
  imageData: string,
  llmCall: () => Promise<ExtractTextResult>
): Promise<{ result: ExtractTextResult; cached: boolean }> {
  const cacheKey = generateCacheKey('extract_text', provider, imageData, '');

  const cached = await getCachedResponse(cacheKey);
  if (cached && isExtractTextResult(cached)) {
    console.log(`Cache hit for extract_text (provider: ${provider})`);
    return { result: cached, cached: true };
  }

  console.log(`Cache miss for extract_text (provider: ${provider})`);
  const result = await llmCall();

  setCachedResponse(cacheKey, 'extract_text', provider, result).catch(() => {});
  return { result, cached: false };
}

/**
 * Cache wrapper for parse_text operation (ParseTextResult).
 */
export async function withParseTextCache(
  provider: string,
  text: string,
  prompt: string,
  llmCall: () => Promise<ParseTextResult>
): Promise<{ result: ParseTextResult; cached: boolean }> {
  const cacheKey = generateCacheKey('parse_text', provider, text, prompt);

  const cached = await getCachedResponse(cacheKey);
  if (cached && isParseTextResult(cached)) {
    console.log(`Cache hit for parse_text (provider: ${provider})`);
    return { result: cached, cached: true };
  }

  console.log(`Cache miss for parse_text (provider: ${provider})`);
  const result = await llmCall();

  setCachedResponse(cacheKey, 'parse_text', provider, result).catch(() => {});
  return { result, cached: false };
}
