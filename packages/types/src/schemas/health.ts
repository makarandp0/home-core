// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

export const DocProcessorStatusSchema = z.object({
  available: z.boolean(),
  version: z.string().optional(),
  url: z.string(),
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
  // Authentication status
  auth: z
    .object({
      enabled: z.boolean(),
      // Firebase client config - only present when auth is enabled
      firebase: z
        .object({
          apiKey: z.string(),
          authDomain: z.string(),
          projectId: z.string(),
          appId: z.string(),
        })
        .optional(),
      // Default user - only present when auth is disabled
      defaultUser: z
        .object({
          id: z.string(),
          email: z.string(),
          displayName: z.string().nullable(),
          photoURL: z.string().nullable(),
        })
        .optional(),
    })
    .optional(),
});

export type Health = z.infer<typeof HealthSchema>;
