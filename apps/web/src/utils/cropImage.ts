import { makAssert } from '@home/utils';
import type { PixelCrop } from 'react-image-crop';

/**
 * Crops an image based on the provided crop coordinates.
 * Returns a data URL of the cropped image.
 */
export function getCroppedImage(
  imageSrc: string,
  crop: PixelCrop
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    makAssert(ctx !== null, 'Canvas 2D context should be available');

    img.onload = () => {
      // Set canvas size to the crop dimensions
      canvas.width = crop.width;
      canvas.height = crop.height;

      // Draw the cropped portion of the image
      ctx.drawImage(
        img,
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
