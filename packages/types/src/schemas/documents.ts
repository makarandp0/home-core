// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import { VisionProviderSchema, DocumentDataSchema } from './vision.js';

// Extraction method used
export const ExtractionMethodSchema = z.enum(['native', 'ocr', 'llm']);
export type ExtractionMethod = z.infer<typeof ExtractionMethodSchema>;

// JSONB metadata stored with documents (for client-side filtering)
export const DocumentJsonMetadataSchema = z
  .object({
    id: z.string().optional(), // document ID (passport number, etc.)
    reference_numbers: z.array(z.string()).optional(),
    parties: z.array(z.string()).optional(),
    date_of_birth: z.string().optional(),
    issuing_authority: z.string().optional(),
    state_province: z.string().optional(),
    address: z
      .object({
        street: z.string().nullish(),
        city: z.string().nullish(),
        state: z.string().nullish(),
        postal_code: z.string().nullish(),
        country: z.string().nullish(),
      })
      .optional(),
    language: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
  })
  .nullable();

export type DocumentJsonMetadata = z.infer<typeof DocumentJsonMetadataSchema>;

// Document metadata (for listing documents)
export const DocumentMetadataSchema = z.object({
  id: z.string(),
  filename: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  // Core fields
  documentType: z.string().nullable(),
  documentOwner: z.string().nullable(),
  expiryDate: z.string().nullable(),
  // New searchable fields
  category: z.string().nullable(),
  issueDate: z.string().nullable(),
  country: z.string().nullable(),
  amountValue: z.string().nullable(),
  amountCurrency: z.string().nullable(),
  // JSONB metadata for additional searchable fields
  metadata: DocumentJsonMetadataSchema,
  // Timestamps
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

// Unified document upload request (combines extract + parse)
export const DocumentUploadRequestSchema = z.object({
  file: z.string().min(1), // base64 data URL
  filename: z.string().min(1),
  provider: VisionProviderSchema.optional(), // uses active provider if not specified
});

export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequestSchema>;

// Unified document upload response data
export const DocumentUploadDataSchema = z.object({
  documentId: z.string(),
  extractedText: z.string(),
  extractionMethod: ExtractionMethodSchema,
  extractionConfidence: z.number().nullish(),
  document: DocumentDataSchema.optional(),
  response: z.string(), // raw LLM parse response
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
  cached: z.boolean().optional(),
});

export type DocumentUploadData = z.infer<typeof DocumentUploadDataSchema>;

// Full API response for document upload
export const DocumentUploadResponseSchema = z.object({
  ok: z.boolean(),
  data: DocumentUploadDataSchema.optional(),
  error: z.string().optional(),
});

export type DocumentUploadResponse = z.infer<typeof DocumentUploadResponseSchema>;

// Thumbnails request body
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ThumbnailsRequestSchema = z.object({
  ids: z
    .array(z.string().regex(uuidRegex, 'Invalid document ID format'))
    .min(1, 'ids must be a non-empty array')
    .max(50, 'Maximum 50 documents per request'),
});

export type ThumbnailsRequest = z.infer<typeof ThumbnailsRequestSchema>;

// Thumbnails response - map of document ID to thumbnail data URL (or null)
export const ThumbnailsResponseSchema = z.record(z.string(), z.string().nullable());
export type ThumbnailsResponse = z.infer<typeof ThumbnailsResponseSchema>;

// Document update request - only editable fields, all optional
export const DocumentUpdateRequestSchema = z.object({
  originalFilename: z
    .string()
    .min(1)
    .max(255)
    .regex(/\S/, 'Filename must contain at least one non-whitespace character')
    .optional(),
  documentOwner: z.string().max(255).nullable().optional(),
  documentType: z.string().max(100).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
  documentNumber: z.string().max(100).nullable().optional(),
  issueDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
});

export type DocumentUpdateRequest = z.infer<typeof DocumentUpdateRequestSchema>;
