import * as React from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCroppedImage, type Rotation } from '@/utils/cropImage';

interface ImageCropModalProps {
  imageUrl: string;
  onCrop: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({ imageUrl, onCrop, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [rotation, setRotation] = React.useState<Rotation>(0);
  const [rotatedPreview, setRotatedPreview] = React.useState<string>(imageUrl);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Generate rotated preview when rotation changes
  React.useEffect(() => {
    if (rotation === 0) {
      setRotatedPreview(imageUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isVerticalRotation = rotation === 90 || rotation === 270;
      canvas.width = isVerticalRotation ? img.naturalHeight : img.naturalWidth;
      canvas.height = isVerticalRotation ? img.naturalWidth : img.naturalHeight;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      setRotatedPreview(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = imageUrl;
  }, [imageUrl, rotation]);

  const ROTATIONS: Rotation[] = [0, 90, 180, 270];

  const rotateLeft = () => {
    setRotation((prev) => {
      const idx = ROTATIONS.indexOf(prev);
      return ROTATIONS[(idx - 1 + 4) % 4];
    });
    // Reset crop when rotation changes since dimensions change
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const rotateRight = () => {
    setRotation((prev) => {
      const idx = ROTATIONS.indexOf(prev);
      return ROTATIONS[(idx + 1) % 4];
    });
    // Reset crop when rotation changes since dimensions change
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const handleApply = async () => {
    if (!imgRef.current) return;

    setIsProcessing(true);
    try {
      const img = imgRef.current;

      // If user only rotated without cropping, use full image
      if (!completedCrop) {
        onCrop(rotatedPreview);
        return;
      }

      // Scale crop coordinates from displayed size to actual image size
      // We use the rotated preview, so natural dimensions are already correct
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const scaledCrop: PixelCrop = {
        unit: 'px',
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      };

      // Crop from the rotated preview (rotation already applied)
      const croppedImageUrl = await getCroppedImage(rotatedPreview, scaledCrop);
      onCrop(croppedImageUrl);
    } catch (error) {
      console.error('Failed to crop image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Escape key to cancel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-card p-4 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Image</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={rotateLeft}
              disabled={isProcessing}
              title="Rotate left"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={rotateRight}
              disabled={isProcessing}
              title="Rotate right"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Crop area */}
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-center">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img
                ref={imgRef}
                src={rotatedPreview}
                alt="Crop preview"
                className="max-h-[60vh] object-contain"
              />
            </ReactCrop>
          </div>
        </div>

        {/* Instructions */}
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Rotate the image or drag to crop
        </p>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={(!completedCrop && rotation === 0) || isProcessing}
          >
            {isProcessing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Applying...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Apply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
