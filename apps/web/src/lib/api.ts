import type { ApiError } from '@home/types';

/**
 * Result type for API calls - either success with data or failure with error
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

/**
 * Options for API requests
 */
interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * Raw API response format from backend (route builder wraps in { ok, data, error })
 */
interface RawApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Schema interface - matches Zod's parse/safeParse methods
 */
interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

/**
 * Makes a typed API request and validates the response
 *
 * @param method - HTTP method
 * @param url - API endpoint (e.g., '/api/documents')
 * @param schema - Zod schema to validate response data
 * @param body - Optional request body (will be JSON stringified)
 * @param options - Optional request options
 * @returns Promise<ApiResult<T>> - Typed result with data or error
 */
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  schema: Schema<T>,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResult<T>> {
  try {
    const init: RequestInit = {
      method,
      signal: options?.signal,
    };

    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const json: RawApiResponse<unknown> = await response.json();

    // Handle API-level errors (ok: false from backend)
    if (!json.ok) {
      return { ok: false, error: json.error ?? 'Request failed' };
    }

    // Validate response data with schema
    const parseResult = schema.safeParse(json.data);
    if (!parseResult.success) {
      console.error('API response validation failed:', parseResult.error);
      return { ok: false, error: 'Invalid response from server' };
    }

    return { ok: true, data: parseResult.data };
  } catch (err) {
    // Handle network/fetch errors
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, error: message };
  }
}

/**
 * Typed API client with methods for each endpoint
 */
export const api = {
  /**
   * GET request
   */
  get<T>(url: string, schema: Schema<T>, options?: RequestOptions): Promise<ApiResult<T>> {
    return request('GET', url, schema, undefined, options);
  },

  /**
   * POST request
   */
  post<T>(url: string, schema: Schema<T>, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> {
    return request('POST', url, schema, body, options);
  },

  /**
   * PUT request
   */
  put<T>(url: string, schema: Schema<T>, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> {
    return request('PUT', url, schema, body, options);
  },

  /**
   * DELETE request
   */
  delete<T>(url: string, schema: Schema<T>, options?: RequestOptions): Promise<ApiResult<T>> {
    return request('DELETE', url, schema, undefined, options);
  },
};

/**
 * Helper to extract error message from ApiError
 */
export function getErrorMessage(error: ApiError): string {
  if (typeof error === 'string') {
    return error;
  }
  return error.message;
}
