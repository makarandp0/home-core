import { makAssert } from '@home/utils';

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB (under Anthropic's 5MB limit)

export function compressImage(file: File, maxSize: number = MAX_IMAGE_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    makAssert(ctx !== null, 'Canvas 2D context should be available');

    img.onload = () => {
      let { width, height } = img;
      let quality = 0.9;

      // Start with original dimensions
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let result = canvas.toDataURL('image/jpeg', quality);

      // Reduce quality and/or dimensions until under maxSize
      while (result.length > maxSize && (quality > 0.1 || width > 800)) {
        if (quality > 0.3) {
          quality -= 0.1;
        } else {
          // Reduce dimensions by 20%
          width = Math.floor(width * 0.8);
          height = Math.floor(height * 0.8);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          quality = 0.8;
        }
        result = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(result);
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    const reader = new FileReader();
    reader.onload = () => {
      makAssert(typeof reader.result === 'string', 'FileReader result should be a string when using readAsDataURL');
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
