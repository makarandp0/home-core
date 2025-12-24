import { z } from 'zod';

export const HealthSchema = z.object({
  ok: z.boolean(),
  // Optional backend commit version (short SHA)
  version: z.string().optional(),
  // Optional doc-processor service version (short SHA)
  docProcessorVersion: z.string().optional(),
  // Doc-processor URL being used
  docProcessorUrl: z.string().optional(),
  // Database connection status
  database: z
    .object({
      connected: z.boolean(),
    })
    .optional(),
  // Which vision providers have API keys configured (redacted key or null)
  configuredProviders: z
    .object({
      anthropic: z.string().nullable(),
      openai: z.string().nullable(),
      gemini: z.string().nullable(),
    })
    .optional(),
  // Document storage status
  documentStorage: z
    .object({
      path: z.string().nullable(),
      accessible: z.boolean(),
      error: z.string().optional(),
    })
    .optional(),
});

export type Health = z.infer<typeof HealthSchema>;
