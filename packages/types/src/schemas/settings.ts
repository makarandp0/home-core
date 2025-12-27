import { z } from 'zod';

// Valid provider types
export const ProviderIdSchema = z.enum(['anthropic', 'openai', 'gemini']);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

// Provider config (returned by API, with redacted key)
export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerType: ProviderIdSchema,
  apiKeyRedacted: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// Create provider config request
export const ProviderConfigCreateSchema = z.object({
  name: z.string().min(1).max(100),
  providerType: ProviderIdSchema,
  apiKey: z.string().min(1, 'API key must be at least 1 character'),
});
export type ProviderConfigCreate = z.infer<typeof ProviderConfigCreateSchema>;

// Update provider config request
export const ProviderConfigUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1, 'API key must be at least 1 character').optional(),
});
export type ProviderConfigUpdate = z.infer<typeof ProviderConfigUpdateSchema>;

// Full settings response
export const SettingsResponseSchema = z.object({
  providers: z.array(ProviderConfigSchema),
  activeProviderId: z.string().nullable(),
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

// Delete response
export const DeleteResponseSchema = z.object({
  deleted: z.boolean(),
});
export type DeleteResponse = z.infer<typeof DeleteResponseSchema>;
