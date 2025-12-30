// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Parse a base64 data URL into components.
 *
 * @param dataUrl - The data URL string (e.g., "data:image/jpeg;base64,...")
 * @returns The parsed mime type and base64 data, or null if invalid format
 */
export function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
}
