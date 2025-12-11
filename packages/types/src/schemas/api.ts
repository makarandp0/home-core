import { z } from 'zod';

export const apiResponse = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    ok: z.boolean(),
    data: data.optional(),
    error: z.string().optional(),
  });
