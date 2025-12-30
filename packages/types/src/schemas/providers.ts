// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

// Provider info returned by the /api/providers endpoint
export const ProviderInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  placeholder: z.string(),
});

export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

export const ProvidersResponseSchema = z.object({
  providers: z.array(ProviderInfoSchema),
});

export type ProvidersResponse = z.infer<typeof ProvidersResponseSchema>;
