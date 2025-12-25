import * as React from 'react';
import { Upload, FileText, Image, X, Camera, Crop } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CameraCapture } from './CameraCapture';

interface DropZoneProps {
  file: File | null;
  fileType: 'image' | 'pdf' | null;
  filePreview: string | null;
  isProcessing: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
  onCameraCapture: (dataUrl: string) => void;
  onReset: () => void;
  onCropClick?: () => void;
  disabled?: boolean;
}

export function DropZone({
  file,
  fileType,
  filePreview,
  isProcessing,
  onFileChange,
  onDrop,
  onCameraCapture,
  onReset,
  onCropClick,
  disabled,
}: DropZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [showCamera, setShowCamera] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleCameraCapture = (dataUrl: string) => {
    onCameraCapture(dataUrl);
    setShowCamera(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    setIsDragging(false);
    if (!disabled) onDrop(e);
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Show file preview/info when file is selected
  if (file && !isProcessing) {
    return (
      <div className="relative rounded-xl border-2 border-border bg-card overflow-hidden">
        {/* File preview area */}
        <div className="p-4">
          {fileType === 'image' && filePreview ? (
            <div className="flex justify-center">
              <img
                src={filePreview}
                alt="Preview"
                className="max-h-64 rounded-lg object-contain"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <FileText className="h-16 w-16" />
                <span className="text-sm font-medium">PDF Document</span>
              </div>
            </div>
          )}
        </div>

        {/* File info bar */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-3">
            {fileType === 'image' ? (
              <Image className="h-5 w-5 text-muted-foreground" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium truncate max-w-[200px]">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {fileType === 'image' && onCropClick && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCropClick}
                className="text-muted-foreground hover:text-foreground"
              >
                <Crop className="h-4 w-4" />
                <span className="sr-only">Crop image</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show drop zone when no file
  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
        disabled && 'opacity-50 cursor-not-allowed',
        isProcessing && 'pointer-events-none'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        onChange={onFileChange}
        className="hidden"
        disabled={disabled}
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <span className="text-sm text-muted-foreground">Processing file...</span>
        </div>
      ) : showCamera ? (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      ) : (
        <>
          <div
            className={cn(
              'mb-4 rounded-full p-4 transition-colors',
              isDragging ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>
          <p className="mb-1 text-sm font-medium">
            {isDragging ? 'Drop your file here' : 'Drag and drop your file here'}
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowCamera(true);
              }}
            >
              <Camera className="mr-2 h-4 w-4" />
              Use Camera
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground/70">
            Supports images and PDF documents
          </p>
        </>
      )}
    </div>
  );
}
