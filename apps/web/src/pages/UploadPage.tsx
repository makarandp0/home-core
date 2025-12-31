import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DropZone } from '../components/DropZone';
import { ImageCropModal } from '../components/ImageCropModal';
import { useSettings, useFileUpload } from '../hooks';
import { Settings as SettingsIcon, Sparkles, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { DocumentUploadDataSchema } from '@home/types';
import { api, getErrorMessage } from '@/lib/api';

export function UploadPage() {
  const settings = useSettings();
  const fileUpload = useFileUpload();
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadComplete, setUploadComplete] = React.useState(false);
  const [uploadStats, setUploadStats] = React.useState({ success: 0, failed: 0 });

  const handleUploadAll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!settings.activeProvider) return;

    const pendingFiles = fileUpload.files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    let successCount = 0;
    let failedCount = 0;

    // Process files sequentially
    for (const fileEntry of pendingFiles) {
      if (!fileEntry.dataUrl) {
        fileUpload.updateFileStatus(fileEntry.id, 'error', 'No file data');
        failedCount++;
        continue;
      }

      fileUpload.updateFileStatus(fileEntry.id, 'uploading');

      try {
        const result = await api.post('/api/documents/upload', DocumentUploadDataSchema, {
          file: fileEntry.dataUrl,
          filename: fileEntry.file.name,
          provider: settings.activeProvider.providerType,
        });

        if (!result.ok) {
          const errorMessage = getErrorMessage(result.error);
          fileUpload.updateFileStatus(
            fileEntry.id,
            'error',
            typeof errorMessage === 'string' ? errorMessage : 'Upload failed'
          );
          failedCount++;
        } else {
          fileUpload.updateFileStatus(fileEntry.id, 'done');
          successCount++;
        }
      } catch (error) {
        const message =
          error instanceof Error && typeof error.message === 'string'
            ? error.message
            : 'Unexpected error during upload';
        fileUpload.updateFileStatus(fileEntry.id, 'error', message);
        failedCount++;
      }
    }

    setIsUploading(false);
    setUploadStats({ success: successCount, failed: failedCount });
    setUploadComplete(true);
  };

  const handleReset = () => {
    fileUpload.reset();
    setUploadComplete(false);
    setUploadStats({ success: 0, failed: 0 });
  };

  const displayError = fileUpload.error;
  const isConfigured = settings.activeProvider !== null;
  const pendingCount = fileUpload.files.filter((f) => f.status === 'pending').length;
  const hasFilesToUpload = pendingCount > 0;

  // Check if all files are done (success or error)
  const allFilesDone =
    fileUpload.files.length > 0 &&
    fileUpload.files.every((f) => f.status === 'done' || f.status === 'error');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Upload Documents</h2>
              <Badge variant="secondary" className="text-xs">
                {settings.loading
                  ? 'Loading...'
                  : settings.activeProvider?.name ?? 'No provider configured'}
              </Badge>
            </div>
            <Link
              to="/settings"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Success State - All uploads complete */}
          {uploadComplete && allFilesDone ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-green-200 bg-green-50 p-8 dark:border-green-900 dark:bg-green-950/30">
                <CheckCircle2 className="mb-3 h-12 w-12 text-green-600 dark:text-green-500" />
                <h3 className="text-lg font-medium text-green-900 dark:text-green-100">
                  Upload complete!
                </h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  {uploadStats.success} document{uploadStats.success !== 1 ? 's' : ''} uploaded
                  successfully
                  {uploadStats.failed > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      , {uploadStats.failed} failed
                    </span>
                  )}
                </p>
              </div>

              {/* Link to view recently uploaded documents */}
              {uploadStats.success > 0 && (
                <Link
                  to="/documents?recent=1hour"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border bg-card hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium">View uploaded documents</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleReset}
              >
                Upload More Documents
              </Button>
            </div>
          ) : (
            <form onSubmit={handleUploadAll} className="space-y-6">
              <DropZone
                files={fileUpload.files}
                isProcessing={fileUpload.isProcessing}
                onFileChange={fileUpload.handleFileChange}
                onDrop={fileUpload.handleDrop}
                onCameraCapture={fileUpload.handleCameraCapture}
                onRemoveFile={fileUpload.removeFile}
                onCropClick={fileUpload.openCropModal}
                disabled={isUploading}
              />

              {fileUpload.cropFile?.preview && (
                <ImageCropModal
                  imageUrl={fileUpload.cropFile.preview}
                  onCrop={fileUpload.applyCrop}
                  onCancel={fileUpload.closeCropModal}
                />
              )}

              {displayError && <ErrorDisplay error={displayError} />}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={
                  isUploading ||
                  !hasFilesToUpload ||
                  !isConfigured ||
                  settings.loading ||
                  fileUpload.isProcessing
                }
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {hasFilesToUpload
                      ? `Upload ${pendingCount} Document${pendingCount !== 1 ? 's' : ''}`
                      : 'Select Files to Upload'}
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
