import { z } from 'zod';

export const HealthSchema = z.object({
  ok: z.boolean(),
  // Optional backend commit version (short SHA)
  version: z.string().optional(),
});

export type Health = z.infer<typeof HealthSchema>;
