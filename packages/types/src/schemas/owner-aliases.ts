// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

// Single owner alias entry
export const OwnerAliasSchema = z.object({
  id: z.string(),
  aliasName: z.string(),
  canonicalName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OwnerAlias = z.infer<typeof OwnerAliasSchema>;

// Create alias request
export const OwnerAliasCreateSchema = z.object({
  aliasName: z.string().min(1, 'Alias name is required').max(255),
  canonicalName: z.string().min(1, 'Canonical name is required').max(255),
});
export type OwnerAliasCreate = z.infer<typeof OwnerAliasCreateSchema>;

// Update alias request
export const OwnerAliasUpdateSchema = z.object({
  aliasName: z.string().min(1).max(255).optional(),
  canonicalName: z.string().min(1).max(255).optional(),
});
export type OwnerAliasUpdate = z.infer<typeof OwnerAliasUpdateSchema>;

// List all aliases response
export const OwnerAliasListResponseSchema = z.object({
  aliases: z.array(OwnerAliasSchema),
  total: z.number(),
});
export type OwnerAliasListResponse = z.infer<typeof OwnerAliasListResponseSchema>;

// Batch apply response - shows how many documents were updated per alias
export const OwnerAliasBatchApplyResponseSchema = z.object({
  updatedCount: z.number(),
  aliases: z.array(z.object({
    aliasName: z.string(),
    canonicalName: z.string(),
    matchedDocuments: z.number(),
  })),
});
export type OwnerAliasBatchApplyResponse = z.infer<typeof OwnerAliasBatchApplyResponseSchema>;

// Suggested owner names response - combines canonical names and existing document owners
export const SuggestedOwnerNamesResponseSchema = z.object({
  names: z.array(z.object({
    name: z.string(),
    isCanonical: z.boolean(), // true if from aliases table, false if from documents
    documentCount: z.number().optional(), // number of documents with this owner (if from documents)
  })),
});
export type SuggestedOwnerNamesResponse = z.infer<typeof SuggestedOwnerNamesResponseSchema>;
