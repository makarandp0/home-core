import { z } from 'zod';

export const HealthSchema = z.object({
  ok: z.boolean(),
  // Optional backend commit version (short SHA)
  version: z.string().optional(),
  // Which vision providers have API keys configured (redacted key or null)
  configuredProviders: z
    .object({
      anthropic: z.string().nullable(),
      openai: z.string().nullable(),
    })
    .optional(),
});

export type Health = z.infer<typeof HealthSchema>;
