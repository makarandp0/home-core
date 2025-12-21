import { z } from 'zod';

// Provider ID validation - accepts any string for flexibility
// The backend registry is the source of truth for valid providers
export const VisionProviderSchema = z.string().min(1);
export type VisionProvider = z.infer<typeof VisionProviderSchema>;

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
