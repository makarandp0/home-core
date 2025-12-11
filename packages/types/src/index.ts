export type ID = string & { readonly __brand: unique symbol };
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export * from './schemas/user';
export * from './schemas/api';
export * from './schemas/health';
