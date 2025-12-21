import { z } from 'zod';

// Provider info returned by the /api/providers endpoint
export const ProviderInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  placeholder: z.string(),
  configured: z.boolean(),
});

export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

export const ProvidersResponseSchema = z.object({
  providers: z.array(ProviderInfoSchema),
});

export type ProvidersResponse = z.infer<typeof ProvidersResponseSchema>;
