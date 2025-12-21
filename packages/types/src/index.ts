export type ID = string & { readonly __brand: unique symbol };
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Node ESM requires explicit extensions
export * from './schemas/user.js';
export * from './schemas/api.js';
export * from './schemas/health.js';
export * from './schemas/vision.js';
export * from './schemas/providers.js';
export * from './schemas/documents.js';
