// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

export const DocProcessorStatusSchema = z.object({
  available: z.boolean(),
  version: z.string().optional(),
  url: z.string(),
  faceModel: z
    .object({
      loaded: z.boolean(),
      model: z.string().nullable(),
    })
    .optional(),
});

export type DocProcessorStatus = z.infer<typeof DocProcessorStatusSchema>;

export const HealthSchema = z.object({
  ok: z.boolean(),
  // Optional backend commit version (short SHA)
  version: z.string().optional(),
  // Doc-processor service status
  docProcessor: DocProcessorStatusSchema.optional(),
  // Database connection status
  database: z
    .object({
      connected: z.boolean(),
    })
    .optional(),
  // Document storage status
  documentStorage: z
    .object({
      path: z.string().nullable(),
      accessible: z.boolean(),
      error: z.string().optional(),
    })
    .optional(),
});

export type Health = z.infer<typeof HealthSchema>;

// Load face model request/response schemas
export const LoadFaceModelRequestSchema = z.object({
  model: z.string().optional().default('buffalo_l'),
});

export type LoadFaceModelRequest = z.infer<typeof LoadFaceModelRequestSchema>;

export const LoadFaceModelResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  model: z.string().optional(),
  error: z.string().optional(),
});

export type LoadFaceModelResponse = z.infer<typeof LoadFaceModelResponseSchema>;
