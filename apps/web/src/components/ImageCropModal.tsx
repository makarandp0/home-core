import * as React from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCroppedImage } from '@/utils/cropImage';

interface ImageCropModalProps {
  imageUrl: string;
  onCrop: (croppedImageUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({ imageUrl, onCrop, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = React.useState<Crop>();
  const [completedCrop, setCompletedCrop] = React.useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current) return;

    setIsProcessing(true);
    try {
      const img = imgRef.current;

      // Scale crop coordinates from displayed size to actual image size
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const scaledCrop: PixelCrop = {
        unit: 'px',
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      };

      const croppedImageUrl = await getCroppedImage(imageUrl, scaledCrop);
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
          <h3 className="text-lg font-semibold">Crop Image</h3>
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
                src={imageUrl}
                alt="Crop preview"
                className="max-h-[60vh] object-contain"
              />
            </ReactCrop>
          </div>
        </div>

        {/* Instructions */}
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Drag to select the area you want to keep
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
            disabled={!completedCrop || isProcessing}
          >
            {isProcessing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Applying...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Apply Crop
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
