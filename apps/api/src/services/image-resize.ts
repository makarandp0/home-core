// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import sharp from 'sharp';
import { Jimp } from 'jimp';
import { parseDataUrl } from '../utils/data-url.js';

// Size limit in bytes of decoded binary data
// Note: Base64 encoding adds ~33% overhead, so we use 3.5MB binary
// which results in ~4.7MB base64 (safely under Anthropic's 5MB limit)
export const DEFAULT_SIZE_LIMIT = 3.5 * 1024 * 1024; // 3.5MB binary → ~4.7MB base64

// Formats supported by LLM providers (Anthropic, OpenAI, Gemini)
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function isFormatSupported(mimeType: string): boolean {
  return SUPPORTED_FORMATS.includes(mimeType.toLowerCase());
}

/**
 * Convert a BMP buffer to PNG buffer using Jimp.
 * Jimp handles BMP files properly and can output PNG.
 */
async function convertBmpToPng(buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const image = await Jimp.read(buffer);
  const pngBuffer = await image.getBuffer('image/png');
  return {
    data: pngBuffer,
    width: image.width,
    height: image.height,
  };
}

export interface ResizeResult {
  imageData: string; // base64 data URL
  resized: boolean; // whether image was modified
  originalSize: number; // bytes
  finalSize: number; // bytes
}

/**
 * Resize an image if it exceeds the size limit.
 * Uses proportional scaling to preserve aspect ratio and all content.
 *
 * @param imageData - Base64 data URL of the image
 * @param maxSizeBytes - Optional size limit in bytes (defaults to DEFAULT_SIZE_LIMIT)
 */
export async function resizeImageIfNeeded(
  imageData: string,
  maxSizeBytes: number = DEFAULT_SIZE_LIMIT
): Promise<ResizeResult> {
  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    // Invalid format, return as-is
    return { imageData, resized: false, originalSize: 0, finalSize: 0 };
  }

  const { mimeType, base64Data } = parsed;
  const buffer = Buffer.from(base64Data, 'base64');
  const originalSize = buffer.length;

  const limit = maxSizeBytes;
  const needsFormatConversion = !isFormatSupported(mimeType);

  // If under limit and format is supported, return original
  if (originalSize <= limit && !needsFormatConversion) {
    return { imageData, resized: false, originalSize, finalSize: originalSize };
  }

  try {
    // Handle BMP files specially since sharp doesn't support them natively
    let workingBuffer: Buffer = buffer;
    let originalWidth: number;
    let originalHeight: number;
    let hasAlpha = false;

    if (mimeType.toLowerCase() === 'image/bmp') {
      // Convert BMP to PNG using Jimp, then let sharp handle the rest
      const converted = await convertBmpToPng(buffer);
      workingBuffer = Buffer.from(converted.data);
      originalWidth = converted.width;
      originalHeight = converted.height;
      hasAlpha = false; // BMP typically doesn't have meaningful alpha
    } else {
      // Use sharp directly for supported formats
      const metadata = await sharp(buffer).metadata();
      originalWidth = metadata.width ?? 1920;
      originalHeight = metadata.height ?? 1080;
      hasAlpha = metadata.hasAlpha && mimeType === 'image/png';
    }

    // Determine output format (JPEG for best compression, unless PNG needed for transparency)
    const outputFormat = hasAlpha ? 'png' : 'jpeg';
    const outputMime = hasAlpha ? 'image/png' : 'image/jpeg';

    // Progressive scaling strategy
    let scaleFactor = 1.0;
    let quality = 85;
    let resultBuffer: Buffer;

    // Try progressively smaller sizes until under limit
    while (true) {
      const newWidth = Math.round(originalWidth * scaleFactor);
      const newHeight = Math.round(originalHeight * scaleFactor);

      const resizedImage = sharp(workingBuffer).resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      if (outputFormat === 'jpeg') {
        resultBuffer = await resizedImage.jpeg({ quality, mozjpeg: true }).toBuffer();
      } else {
        resultBuffer = await resizedImage.png({ compressionLevel: 9 }).toBuffer();
      }

      // Check if under limit
      if (resultBuffer.length <= limit) {
        break;
      }

      // Try reducing quality first (JPEG only)
      if (outputFormat === 'jpeg' && quality > 60) {
        quality -= 10;
        continue;
      }

      // Then reduce size
      if (scaleFactor > 0.3) {
        scaleFactor -= 0.1;
        quality = 85; // Reset quality when scaling down
        continue;
      }

      // Minimum scale reached, accept what we have
      break;
    }

    const finalBase64 = resultBuffer.toString('base64');
    const finalDataUrl = `data:${outputMime};base64,${finalBase64}`;

    const reason = needsFormatConversion
      ? `converted from ${mimeType} to ${outputMime}`
      : `resized (scale: ${(scaleFactor * 100).toFixed(0)}%, quality: ${quality})`;
    console.log(
      `Image processed: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ` +
        `${(resultBuffer.length / 1024 / 1024).toFixed(2)}MB - ${reason}`
    );

    return {
      imageData: finalDataUrl,
      resized: true,
      originalSize,
      finalSize: resultBuffer.length,
    };
  } catch (err) {
    console.error('Failed to process image:', err);
    // If format conversion was required, we can't fall back to the original unsupported format
    if (needsFormatConversion) {
      throw new Error(`Failed to convert image from ${mimeType}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    // Only fall back to original if format was already supported (resize-only failure)
    return { imageData, resized: false, originalSize, finalSize: originalSize };
  }
}
