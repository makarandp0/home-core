import { makAssert } from '@home/utils';
import type { PixelCrop } from 'react-image-crop';

/**
 * Rotation in degrees (0, 90, 180, 270)
 */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Crops and optionally rotates an image based on the provided parameters.
 * Returns a data URL of the processed image.
 *
 * @param imageSrc - The source image data URL
 * @param crop - The crop coordinates (in the rotated image's coordinate space)
 * @param rotation - Rotation in degrees (0, 90, 180, 270)
 */
export function getCroppedImage(
  imageSrc: string,
  crop: PixelCrop,
  rotation: Rotation = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    makAssert(ctx !== null, 'Canvas 2D context should be available');

    img.onload = () => {
      // First, create a rotated version of the full image
      const rotatedCanvas = document.createElement('canvas');
      const rotatedCtx = rotatedCanvas.getContext('2d');
      makAssert(rotatedCtx !== null, 'Canvas 2D context should be available');

      // Calculate rotated dimensions
      const isVerticalRotation = rotation === 90 || rotation === 270;
      const rotatedWidth = isVerticalRotation ? img.naturalHeight : img.naturalWidth;
      const rotatedHeight = isVerticalRotation ? img.naturalWidth : img.naturalHeight;

      rotatedCanvas.width = rotatedWidth;
      rotatedCanvas.height = rotatedHeight;

      // Apply rotation transform
      rotatedCtx.save();
      rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
      rotatedCtx.rotate((rotation * Math.PI) / 180);
      rotatedCtx.drawImage(
        img,
        -img.naturalWidth / 2,
        -img.naturalHeight / 2
      );
      rotatedCtx.restore();

      // Now crop from the rotated image
      canvas.width = crop.width;
      canvas.height = crop.height;

      ctx.drawImage(
        rotatedCanvas,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );

      // Convert to data URL with high quality
      const result = canvas.toDataURL('image/jpeg', 0.9);
      resolve(result);
    };

    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = imageSrc;
  });
}
