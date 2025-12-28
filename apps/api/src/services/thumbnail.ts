import sharp from 'sharp';
import { parseDataUrl } from '../utils/data-url.js';

// Thumbnail configuration
const THUMBNAIL_SIZE = 150; // Max width/height in pixels
const THUMBNAIL_QUALITY = 70; // JPEG quality (0-100)

export interface ThumbnailResult {
  thumbnail: string; // base64 data URL
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Generate a thumbnail from an image data URL.
 *
 * @param imageData - Base64 data URL of the source image
 * @returns ThumbnailResult with the thumbnail as a base64 data URL
 */
export async function generateThumbnail(imageData: string): Promise<ThumbnailResult | null> {
  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    console.error('Invalid data URL format for thumbnail generation');
    return null;
  }

  const { base64Data } = parsed;
  const buffer = Buffer.from(base64Data, 'base64');

  try {
    // Resize to thumbnail size, maintaining aspect ratio
    const resized = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY, mozjpeg: true })
      .toBuffer();

    // Get dimensions of the thumbnail
    const metadata = await sharp(resized).metadata();

    const thumbnailBase64 = resized.toString('base64');
    const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBase64}`;

    return {
      thumbnail: thumbnailDataUrl,
      width: metadata.width ?? THUMBNAIL_SIZE,
      height: metadata.height ?? THUMBNAIL_SIZE,
      sizeBytes: resized.length,
    };
  } catch (err) {
    console.error('Failed to generate thumbnail:', err);
    return null;
  }
}

/**
 * Generate a thumbnail from raw image bytes (PNG format from PDF rendering).
 *
 * @param imageBytes - Raw image bytes (e.g., PNG from PDF first page)
 * @returns ThumbnailResult with the thumbnail as a base64 data URL
 */
export async function generateThumbnailFromBytes(
  imageBytes: Buffer
): Promise<ThumbnailResult | null> {
  try {
    const resized = await sharp(imageBytes)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY, mozjpeg: true })
      .toBuffer();

    const metadata = await sharp(resized).metadata();

    const thumbnailBase64 = resized.toString('base64');
    const thumbnailDataUrl = `data:image/jpeg;base64,${thumbnailBase64}`;

    return {
      thumbnail: thumbnailDataUrl,
      width: metadata.width ?? THUMBNAIL_SIZE,
      height: metadata.height ?? THUMBNAIL_SIZE,
      sizeBytes: resized.length,
    };
  } catch (err) {
    console.error('Failed to generate thumbnail from bytes:', err);
    return null;
  }
}
