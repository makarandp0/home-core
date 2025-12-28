import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ZodSchema, ZodError, ZodIssue } from 'zod';
import type { ApiResponse } from '@home/types';

/**
 * Format Zod validation errors into a user-friendly string.
 */
export function formatZodError(error: ZodError): string {
  return error.issues
    .map((e: ZodIssue) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message))
    .join(', ');
}

/**
 * Custom error class for route handlers to throw.
 * The builder will catch these and format them as ApiResponse errors.
 */
export class RouteError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'RouteError';
  }
}

/**
 * Throw a 400 Bad Request error.
 */
export function badRequest(message: string): never {
  throw new RouteError(message, 400);
}

/**
 * Throw a 404 Not Found error.
 */
export function notFound(message: string): never {
  throw new RouteError(message, 404);
}

/**
 * Throw a 500 Internal Server Error.
 */
export function serverError(message: string): never {
  throw new RouteError(message, 500);
}

/**
 * Context passed to route handlers with validated data.
 */
export interface RouteContext<TBody, TParams, TQuery> {
  body: TBody;
  params: TParams;
  query: TQuery;
  request: FastifyRequest;
  reply: FastifyReply;
}

/**
 * Schema configuration for route validation.
 */
export interface RouteSchemas<TBody, TParams, TQuery> {
  body?: ZodSchema<TBody>;
  params?: ZodSchema<TParams>;
  query?: ZodSchema<TQuery>;
}

/**
 * Configuration for a validated route.
 */
interface RouteConfig<TBody, TParams, TQuery, TResponse> {
  url: string;
  schema?: RouteSchemas<TBody, TParams, TQuery>;
  handler: (ctx: RouteContext<TBody, TParams, TQuery>) => Promise<TResponse>;
}

type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Creates a successful validation result. Uses generics to infer the type from the data.
 */
function validationSuccess<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

/**
 * Creates a failed validation result.
 */
function validationFailure<T>(error: string): ValidationResult<T> {
  return { success: false, error };
}

/**
 * Helper to validate and extract data, returning either validated data or an error response.
 */
function validateSchema<T>(schema: ZodSchema<T> | undefined, data: unknown): ValidationResult<T> {
  if (!schema) {
    // No schema means we pass through the data as-is
    // This is safe because T defaults to `unknown` when no schema is provided
    // eslint-disable-next-line no-restricted-syntax -- Required for generic pass-through when no schema is provided
    return validationSuccess(data as T);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    return validationFailure(`Validation error: ${formatZodError(result.error)}`);
  }
  return validationSuccess(result.data);
}

/**
 * Creates a validated route with automatic schema validation.
 * Wraps response in ApiResponse format and handles validation errors.
 */
function createValidatedRoute<TBody = unknown, TParams = unknown, TQuery = unknown, TResponse = unknown>(
  fastify: FastifyInstance,
  method: 'get' | 'post' | 'put' | 'delete',
  config: RouteConfig<TBody, TParams, TQuery, TResponse>
) {
  fastify[method](config.url, async (request, reply): Promise<ApiResponse<TResponse>> => {
    // Validate body
    const bodyResult = validateSchema(config.schema?.body, request.body);
    if (!bodyResult.success) {
      reply.code(400);
      return { ok: false, error: bodyResult.error };
    }

    // Validate params
    const paramsResult = validateSchema(config.schema?.params, request.params);
    if (!paramsResult.success) {
      reply.code(400);
      return { ok: false, error: paramsResult.error };
    }

    // Validate query
    const queryResult = validateSchema(config.schema?.query, request.query);
    if (!queryResult.success) {
      reply.code(400);
      return { ok: false, error: queryResult.error };
    }

    try {
      // Call handler with validated context (using parsed data from Zod)
      const data = await config.handler({
        body: bodyResult.data,
        params: paramsResult.data,
        query: queryResult.data,
        request,
        reply,
      });

      return { ok: true, data };
    } catch (err) {
      // Handle RouteError specially
      if (err instanceof RouteError) {
        reply.code(err.statusCode);
        return { ok: false, error: err.message };
      }

      // Re-throw unknown errors for global error handler
      throw err;
    }
  });
}

/**
 * Route builder factory for creating validated routes on a Fastify instance.
 *
 * @example
 * ```typescript
 * const routes = createRouteBuilder(fastify);
 *
 * routes.post({
 *   url: '/documents/upload',
 *   schema: { body: DocumentUploadRequestSchema },
 *   handler: async ({ body }) => {
 *     // body is validated and typed
 *     return { documentId: '123' };
 *   },
 * });
 * ```
 */
export function createRouteBuilder(fastify: FastifyInstance) {
  return {
    get: <TBody = unknown, TParams = unknown, TQuery = unknown, TResponse = unknown>(
      config: RouteConfig<TBody, TParams, TQuery, TResponse>
    ) => createValidatedRoute(fastify, 'get', config),

    post: <TBody = unknown, TParams = unknown, TQuery = unknown, TResponse = unknown>(
      config: RouteConfig<TBody, TParams, TQuery, TResponse>
    ) => createValidatedRoute(fastify, 'post', config),

    put: <TBody = unknown, TParams = unknown, TQuery = unknown, TResponse = unknown>(
      config: RouteConfig<TBody, TParams, TQuery, TResponse>
    ) => createValidatedRoute(fastify, 'put', config),

    delete: <TBody = unknown, TParams = unknown, TQuery = unknown, TResponse = unknown>(
      config: RouteConfig<TBody, TParams, TQuery, TResponse>
    ) => createValidatedRoute(fastify, 'delete', config),
  };
}
