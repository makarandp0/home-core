// Copyright (c) 2025 Makarand Patwardhan
// SPDX-License-Identifier: AGPL-3.0-only

import { makAssert } from '@ohs/utils';
import type { PixelCrop } from 'react-image-crop';

/**
 * Rotation in degrees (0, 90, 180, 270)
 */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Crops an image based on the provided crop coordinates.
 * Returns a data URL of the cropped image.
 *
 * @param imageSrc - The source image data URL (already rotated if needed)
 * @param crop - The crop coordinates in pixels
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
      canvas.width = crop.width;
      canvas.height = crop.height;

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
