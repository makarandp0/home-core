// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import type { ApiError } from '@ohs/types';
import { getFirebaseAuth } from './firebase';

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
 * Get the current user's ID token for API requests.
 * Returns null if auth is disabled (Firebase not initialized) or user is not signed in.
 */
export async function getAuthToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) {
    return null;
  }

  try {
    return await auth.currentUser.getIdToken();
  } catch (err) {
    console.error('Failed to get auth token:', err);
    return null;
  }
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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  schema: Schema<T>,
  body?: unknown,
  options?: RequestOptions
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {};

    // Add auth header if token available
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
      method,
      headers,
      signal: options?.signal,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    // Handle HTTP-level errors before attempting to parse JSON
    if (!response.ok) {
      try {
        const errorJson: RawApiResponse<unknown> = await response.json();
        if (errorJson?.error !== undefined) {
          return { ok: false, error: errorJson.error };
        }
      } catch {
        // Ignore JSON parsing errors and fall back to text below
      }

      let message = `Request failed with status ${response.status}`;
      try {
        const text = await response.text();
        if (text) {
          message += `: ${text}`;
        }
      } catch {
        // Ignore text parsing errors, keep default message
      }

      return { ok: false, error: message };
    }

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

  /**
   * PATCH request
   */
  patch<T>(url: string, schema: Schema<T>, body?: unknown, options?: RequestOptions): Promise<ApiResult<T>> {
    return request('PATCH', url, schema, body, options);
  },
};

/**
 * Helper to extract error message from ApiError
 */
export function getErrorMessage(error: ApiError): string {
  if (typeof error === 'string') {
    return error;
  }

  const baseMessage = error.message;
  const details = error.details;

  if (details !== undefined) {
    try {
      const serializedDetails =
        typeof details === 'string' ? details : JSON.stringify(details);
      return serializedDetails ? `${baseMessage}: ${serializedDetails}` : baseMessage;
    } catch {
      return baseMessage;
    }
  }

  return baseMessage;
}
