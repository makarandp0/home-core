import * as React from 'react';
import { Upload, FileText, Image, X, Camera, Plus, CheckCircle2, AlertCircle, Loader2, Crop } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CameraCapture } from './CameraCapture';
import { type FileEntry, type FileStatus } from '@/hooks/useFileUpload';

interface DropZoneProps {
  files: FileEntry[];
  isProcessing: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>) => void;
  onCameraCapture: (dataUrl: string) => void;
  onRemoveFile: (id: string) => void;
  onCropClick: (id: string) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileStatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case 'uploading':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
}

function FileListItem({
  entry,
  onRemove,
  onCropClick,
  disabled,
}: {
  entry: FileEntry;
  onRemove: () => void;
  onCropClick: () => void;
  disabled?: boolean;
}) {
  const isUploading = entry.status === 'uploading';
  const isDone = entry.status === 'done';
  const isError = entry.status === 'error';
  const canEdit = !isDone && !isUploading;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors',
        isDone && 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20',
        isError && 'border-destructive/50 bg-destructive/5'
      )}
    >
      {/* Thumbnail / Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        {entry.fileType === 'image' && entry.preview ? (
          <img
            src={entry.preview}
            alt=""
            className="h-10 w-10 rounded-md object-cover"
          />
        ) : entry.fileType === 'image' ? (
          <Image className="h-5 w-5 text-muted-foreground" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* File info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{entry.file.name}</span>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(entry.file.size)}
          {entry.error && (
            <span className="ml-2 text-destructive">{entry.error}</span>
          )}
        </span>
      </div>

      {/* Status / Actions */}
      <div className="flex items-center gap-1">
        <FileStatusIcon status={entry.status} />
        {canEdit && entry.fileType === 'image' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCropClick}
            disabled={disabled}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Crop className="h-4 w-4" />
            <span className="sr-only">Crop image</span>
          </Button>
        )}
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export function DropZone({
  files,
  isProcessing,
  onFileChange,
  onDrop,
  onCameraCapture,
  onRemoveFile,
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

  // Show file list when files are selected
  if (files.length > 0 && !isProcessing) {
    return (
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          onChange={onFileChange}
          className="hidden"
          disabled={disabled}
          multiple={true}
        />

        {/* File list */}
        <div className="space-y-2">
          {files.map((entry) => (
            <FileListItem
              key={entry.id}
              entry={entry}
              onRemove={() => onRemoveFile(entry.id)}
              onCropClick={() => onCropClick(entry.id)}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Add more files button */}
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'flex items-center justify-center rounded-lg border-2 border-dashed p-4 transition-all cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Plus className="h-4 w-4" />
            <span>Add more files</span>
          </div>
        </div>
      </div>
    );
  }

  // Show drop zone when no files
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
        multiple={true}
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <span className="text-sm text-muted-foreground">Processing files...</span>
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
            {isDragging ? 'Drop your files here' : 'Drag and drop your files here'}
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
