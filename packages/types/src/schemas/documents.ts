import { z } from 'zod';

// Document processing request (base64 input)
export const DocumentProcessRequestSchema = z.object({
  file: z.string().min(1), // base64-encoded file content
  filename: z.string().min(1), // original filename for type detection
});

export type DocumentProcessRequest = z.infer<typeof DocumentProcessRequestSchema>;

// Extraction method used
export const ExtractionMethodSchema = z.enum(['native', 'ocr', 'llm']);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

// Document processing result data
export const DocumentProcessDataSchema = z.object({
  text: z.string(),
  pageCount: z.number(),
  method: ExtractionMethodSchema,
  confidence: z.number().nullish(), // OCR confidence (0-1), only for OCR method. nullish allows null from Python None
  documentId: z.string(), // ID of stored document
});

export type DocumentProcessData = z.infer<typeof DocumentProcessDataSchema>;

// Full API response for document processing
export const DocumentProcessResponseSchema = z.object({
  ok: z.boolean(),
  data: DocumentProcessDataSchema.optional(),
  error: z.string().optional(),
});

export type DocumentProcessResponse = z.infer<typeof DocumentProcessResponseSchema>;

// Document metadata (for listing documents)
export const DocumentMetadataSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  documentType: z.string().nullable(),
  documentOwner: z.string().nullable(),
  expiryDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

// List documents response
export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentMetadataSchema),
  total: z.number(),
});

export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;
