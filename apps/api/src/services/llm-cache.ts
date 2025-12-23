import { createHash } from 'node:crypto';
import { getDb, llmCache, eq } from '@home/db';
import type { ExtractTextResult, ParseTextResult, VisionResult } from '../providers/types.js';

export type CacheableOperation = 'extract_text' | 'parse_text' | 'analyze';

export type CacheableResult = ExtractTextResult | ParseTextResult | VisionResult;

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
 */
export async function getCachedResponse<T extends CacheableResult>(
  cacheKey: string
): Promise<T | null> {
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

    return result[0].responseData as T;
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
 * Higher-order function that wraps an LLM call with caching.
 * Returns cached result if available, otherwise calls the LLM and caches the result.
 */
export async function withCache<T extends CacheableResult>(
  operation: CacheableOperation,
  provider: string,
  inputData: string,
  prompt: string,
  llmCall: () => Promise<T>
): Promise<{ result: T; cached: boolean }> {
  const cacheKey = generateCacheKey(operation, provider, inputData, prompt);

  // Try to get cached response
  const cached = await getCachedResponse<T>(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${operation} (provider: ${provider})`);
    return { result: cached, cached: true };
  }

  // No cache hit - call LLM
  console.log(`Cache miss for ${operation} (provider: ${provider})`);
  const result = await llmCall();

  // Cache the result (fire and forget)
  setCachedResponse(cacheKey, operation, provider, result).catch(() => {
    // Already logged in setCachedResponse
  });

  return { result, cached: false };
}
