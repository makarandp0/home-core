import { z } from 'zod';

export const VisionProviderSchema = z.enum(['openai', 'anthropic']);
export type VisionProvider = z.infer<typeof VisionProviderSchema>;

export const VisionRequestSchema = z.object({
  image: z.string().min(1),
  prompt: z.string().min(1),
  apiKey: z.string().optional(),
  provider: VisionProviderSchema,
});

export type VisionRequest = z.infer<typeof VisionRequestSchema>;

export const VisionResponseSchema = z.object({
  response: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type VisionResponse = z.infer<typeof VisionResponseSchema>;
