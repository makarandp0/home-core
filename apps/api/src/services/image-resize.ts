import sharp from 'sharp';

// Size limit in bytes of decoded binary data
// Note: Base64 encoding adds ~33% overhead, so we use 3.5MB binary
// which results in ~4.7MB base64 (safely under Anthropic's 5MB limit)
export const DEFAULT_SIZE_LIMIT = 3.5 * 1024 * 1024; // 3.5MB binary → ~4.7MB base64

export interface ResizeResult {
  imageData: string; // base64 data URL
  resized: boolean; // whether image was modified
  originalSize: number; // bytes
  finalSize: number; // bytes
}

/**
 * Parse a base64 data URL into components.
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
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

  // If under limit, return original
  if (originalSize <= limit) {
    return { imageData, resized: false, originalSize, finalSize: originalSize };
  }

  try {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width ?? 1920;
    const originalHeight = metadata.height ?? 1080;

    // Determine output format (JPEG for best compression, unless PNG needed for transparency)
    const hasAlpha = metadata.hasAlpha && mimeType === 'image/png';
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

      const resizedImage = sharp(buffer).resize(newWidth, newHeight, {
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

    console.log(
      `Image resized: ${(originalSize / 1024 / 1024).toFixed(2)}MB -> ` +
        `${(resultBuffer.length / 1024 / 1024).toFixed(2)}MB ` +
        `(scale: ${(scaleFactor * 100).toFixed(0)}%, quality: ${quality})`
    );

    return {
      imageData: finalDataUrl,
      resized: true,
      originalSize,
      finalSize: resultBuffer.length,
    };
  } catch (err) {
    console.error('Failed to resize image:', err);
    // Return original on error
    return { imageData, resized: false, originalSize, finalSize: originalSize };
  }
}
