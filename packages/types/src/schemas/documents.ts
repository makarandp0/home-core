import { z } from 'zod';

// Document processing request (base64 input)
export const DocumentProcessRequestSchema = z.object({
  file: z.string().min(1), // base64-encoded file content
  filename: z.string().min(1), // original filename for type detection
});

export type DocumentProcessRequest = z.infer<typeof DocumentProcessRequestSchema>;

// Extraction method used
export const ExtractionMethodSchema = z.enum(['native', 'ocr']);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

// Document processing result data
export const DocumentProcessDataSchema = z.object({
  text: z.string(),
  pageCount: z.number(),
  method: ExtractionMethodSchema,
  confidence: z.number().nullish(), // OCR confidence (0-1), only for OCR method. nullish allows null from Python None
});

export type DocumentProcessData = z.infer<typeof DocumentProcessDataSchema>;

// Full API response for document processing
export const DocumentProcessResponseSchema = z.object({
  ok: z.boolean(),
  data: DocumentProcessDataSchema.optional(),
  error: z.string().optional(),
});

export type DocumentProcessResponse = z.infer<typeof DocumentProcessResponseSchema>;
