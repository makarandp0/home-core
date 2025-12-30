// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

// Provider ID validation - accepts any string for flexibility
// The backend registry is the source of truth for valid providers
export const VisionProviderSchema = z.string().min(1);
export type VisionProvider = z.infer<typeof VisionProviderSchema>;

// Allow any JSON value in fields (strings, numbers, booleans, nulls, arrays, objects)
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

// Document category enum
export const DocumentCategorySchema = z.enum([
  'identity',
  'financial',
  'legal',
  'medical',
  'property',
  'vehicle',
  'education',
  'insurance',
  'correspondence',
  'other',
]);

export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;

// Confidence level enum
export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);

export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

// Address schema
export const AddressSchema = z
  .object({
    street: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    postal_code: z.string().nullish(),
    country: z.string().nullish(),
  })
  .nullish();

export type Address = z.infer<typeof AddressSchema>;

// Amount schema for financial documents
// Note: LLM may return {value: null, currency: null} for non-financial docs
export const AmountSchema = z
  .object({
    value: z.number().nullish(),
    currency: z.string().nullish(),
  })
  .nullish();

export type Amount = z.infer<typeof AmountSchema>;

export const DocumentDataSchema = z.object({
  // Core identification
  document_type: z.string(),
  category: DocumentCategorySchema.optional(),
  id: z.string().nullish(),
  reference_numbers: z.array(z.string()).optional(),

  // People and parties
  name: z.string().nullish(),
  parties: z.array(z.string()).optional(),

  // Dates
  issue_date: z.string().nullish(),
  expiry_date: z.string().nullish(),
  date_of_birth: z.string().nullish(),

  // Issuer information
  issuing_authority: z.string().nullish(),
  country: z.string().nullish(),
  state_province: z.string().nullish(),

  // Location
  address: AddressSchema,

  // Financial
  amount: AmountSchema,

  // Metadata
  language: z.string().optional(),
  fields: z.record(z.string(), JsonValueSchema),
  keywords: z.array(z.string()).max(10).optional(),
  confidence: ConfidenceLevelSchema.optional(),
});

export type DocumentData = z.infer<typeof DocumentDataSchema>;
