export type ID = string & { readonly __brand: unique symbol };

// Error can be a simple string or an object with message and details
export interface ApiErrorDetail {
  message: string; // Short, user-friendly error message
  details?: string; // Longer, technical details (stack trace, validation errors, etc.)
}

export type ApiError = string | ApiErrorDetail;

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

// Helper to normalize error to ApiErrorDetail
export function normalizeApiError(error: ApiError | undefined): ApiErrorDetail | null {
  if (!error) return null;
  if (typeof error === 'string') {
    return { message: error };
  }
  return error;
}

// Node ESM requires explicit extensions
export * from './schemas/user.js';
export * from './schemas/api.js';
export * from './schemas/health.js';
export * from './schemas/vision.js';
export * from './schemas/providers.js';
export * from './schemas/documents.js';
