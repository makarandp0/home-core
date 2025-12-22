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

// Schema for text extraction from images (Step 2 - LLM re-extraction for low confidence)
export const VisionExtractTextRequestSchema = z.object({
  image: z.string().min(1),
  provider: VisionProviderSchema,
  apiKey: z.string().optional(),
});

export type VisionExtractTextRequest = z.infer<typeof VisionExtractTextRequestSchema>;

export const VisionExtractTextResponseSchema = z.object({
  extractedText: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type VisionExtractTextResponse = z.infer<typeof VisionExtractTextResponseSchema>;

// Schema for parsing text to JSON document (Step 3)
export const VisionParseRequestSchema = z.object({
  text: z.string().min(1),
  provider: VisionProviderSchema,
  apiKey: z.string().optional(),
  prompt: z.string().optional(),
});

export type VisionParseRequest = z.infer<typeof VisionParseRequestSchema>;

export const VisionParseResponseSchema = z.object({
  document: DocumentDataSchema.optional(),
  response: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type VisionParseResponse = z.infer<typeof VisionParseResponseSchema>;
