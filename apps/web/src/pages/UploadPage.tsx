import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { DocumentDataDisplay } from '../components/DocumentDataDisplay';
import { JsonDisplay } from '../components/JsonDisplay';
import { DropZone } from '../components/DropZone';
import { useSettings, useFileUpload, useDocumentAnalysis } from '../hooks';
import { Settings as SettingsIcon, Sparkles, CheckCircle2 } from 'lucide-react';

export function UploadPage() {
  const settings = useSettings();
  const fileUpload = useFileUpload();
  const analysis = useDocumentAnalysis();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileUpload.file || !fileUpload.fileDataUrl) {
      return;
    }

    fileUpload.clearError();
    analysis.reset();

    await analysis.analyze({
      fileDataUrl: fileUpload.fileDataUrl,
      fileName: fileUpload.file.name,
      fileType: fileUpload.fileType,
      provider: settings.selectedProvider,
      apiKey: settings.apiKey.trim() || undefined,
      prompt: settings.prompt.trim() || undefined,
    });
  };

  const displayError = fileUpload.error ?? analysis.error;
  const hasResults = analysis.document || analysis.parseResponse;
  const isReady = fileUpload.file && fileUpload.fileDataUrl && !fileUpload.isProcessing;
  const isComplete = hasResults && !analysis.isProcessing;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Upload Document</h2>
              <Badge variant="secondary" className="text-xs">
                {settings.selectedMeta?.label ?? 'No provider'}
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
          {/* Success State */}
          {isComplete ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-green-200 bg-green-50 p-8 dark:border-green-900 dark:bg-green-950/30">
                <CheckCircle2 className="mb-3 h-12 w-12 text-green-600 dark:text-green-500" />
                <h3 className="text-lg font-medium text-green-900 dark:text-green-100">
                  Document uploaded!
                </h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  {analysis.document?.document_type || 'Document'} processed successfully
                </p>
              </div>

              <Collapsible title="View Details">
                <div className="space-y-4">
                  {analysis.parseResponse && <JsonDisplay data={analysis.parseResponse} />}
                  {analysis.document && <DocumentDataDisplay document={analysis.document} />}
                  {analysis.extractedText && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <h4 className="mb-2 text-sm font-medium">Extracted Text</h4>
                      <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
                        {analysis.extractedText}
                      </p>
                    </div>
                  )}
                </div>
              </Collapsible>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  fileUpload.reset();
                  analysis.reset();
                }}
              >
                Upload Another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <DropZone
                file={fileUpload.file}
                fileType={fileUpload.fileType}
                filePreview={fileUpload.filePreview}
                isProcessing={fileUpload.isProcessing}
                onFileChange={fileUpload.handleFileChange}
                onDrop={fileUpload.handleDrop}
                onCameraCapture={fileUpload.handleCameraCapture}
                onReset={fileUpload.reset}
                disabled={analysis.isProcessing}
              />

              {displayError && <ErrorDisplay error={displayError} />}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={
                  analysis.isProcessing ||
                  !isReady ||
                  !settings.selectedProvider ||
                  settings.providersLoading
                }
              >
                {analysis.isProcessing ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Document
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
