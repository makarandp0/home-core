import { z } from 'zod';

export const VisionProviderSchema = z.enum(['openai', 'anthropic', 'gemini']);
export type VisionProvider = z.infer<typeof VisionProviderSchema>;

// Provider metadata - single source of truth for UI labels and placeholders
export const VISION_PROVIDERS = {
  anthropic: {
    id: 'anthropic' as const,
    label: 'Anthropic (Claude)',
    shortLabel: 'Anthropic',
    placeholder: 'sk-ant-...',
  },
  openai: {
    id: 'openai' as const,
    label: 'OpenAI (GPT-4o)',
    shortLabel: 'OpenAI',
    placeholder: 'sk-...',
  },
  gemini: {
    id: 'gemini' as const,
    label: 'Google (Gemini)',
    shortLabel: 'Google',
    placeholder: 'AIza...',
  },
} as const;

export type VisionProviderMetadata = (typeof VISION_PROVIDERS)[VisionProvider];
export const VISION_PROVIDER_LIST = Object.values(VISION_PROVIDERS);

export const VisionRequestSchema = z.object({
  image: z.string().min(1),
  prompt: z.string().optional(),
  apiKey: z.string().optional(),
  provider: VisionProviderSchema,
});

export type VisionRequest = z.infer<typeof VisionRequestSchema>;

export const DocumentDataSchema = z.object({
  document_type: z.string(),
  id: z.string().nullish(),
  expiry_date: z.string().nullish(),
  name: z.string().nullish(),
  fields: z.record(z.string(), z.string()),
});

export type DocumentData = z.infer<typeof DocumentDataSchema>;

export const VisionResponseSchema = z.object({
  extractedText: z.string(),
  response: z.string(),
  document: DocumentDataSchema.optional(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type VisionResponse = z.infer<typeof VisionResponseSchema>;
