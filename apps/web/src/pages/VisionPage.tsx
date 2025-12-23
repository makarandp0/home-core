import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { StepProgress } from '../components/StepProgress';
import { DocumentDataDisplay } from '../components/DocumentDataDisplay';
import { ExtractionBadges } from '../components/ExtractionBadges';
import { useProviders, useFileUpload, useDocumentAnalysis } from '../hooks';

export function VisionPage() {
  const providers = useProviders();
  const fileUpload = useFileUpload();
  const analysis = useDocumentAnalysis();

  const [apiKey, setApiKey] = React.useState('');
  const [prompt, setPrompt] = React.useState('');

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
      provider: providers.selectedProvider,
      apiKey: apiKey.trim() || undefined,
      prompt: prompt.trim() || undefined,
    });
  };

  const providerLabel = providers.selectedMeta?.label?.split(' ')[0] ?? 'Provider';
  const keyPlaceholder = providers.selectedMeta?.placeholder ?? '';

  const displayError = fileUpload.error ?? analysis.error;
  const hasResults = analysis.extractedText || analysis.document || analysis.parseResponse;

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-2 text-xl font-semibold">Document Analysis</h2>
      <p className="mb-6 text-muted-foreground">
        Upload an image or PDF to extract and parse document data.
      </p>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Provider</Label>
            {providers.loading ? (
              <div className="text-sm text-muted-foreground">Loading providers...</div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {providers.providers.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="provider"
                      value={p.id}
                      checked={providers.selectedProvider === p.id}
                      onChange={() => providers.setSelectedProvider(p.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="text-sm">{p.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>File (Image or PDF)</Label>
            <Input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={fileUpload.handleFileChange}
              className="cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
            />
            {fileUpload.file && (
              <p className="text-sm text-muted-foreground">
                Selected: {fileUpload.file.name} ({fileUpload.fileType?.toUpperCase()})
              </p>
            )}
            {fileUpload.filePreview && (
              <div className="mt-4">
                <img
                  src={fileUpload.filePreview}
                  alt="Preview"
                  className="max-h-64 rounded-lg border border-border"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Prompt <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Custom instructions for parsing. Leave empty for default document extraction."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>
              {providerLabel} API Key{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={keyPlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use server-configured API key, or enter your own.
            </p>
          </div>

          {displayError && analysis.currentStep !== 'error' && <ErrorDisplay error={displayError} />}

          <Button
            type="submit"
            disabled={
              analysis.isProcessing ||
              !fileUpload.file ||
              !providers.selectedProvider ||
              providers.loading
            }
          >
            {analysis.isProcessing ? 'Processing...' : 'Analyze Document'}
          </Button>
        </form>
      </Card>

      {/* Step Progress Indicator */}
      {analysis.currentStep !== 'idle' && (
        <div className="mt-8">
          <StepProgress
            statuses={analysis.stepStatus}
            extractionMethod={analysis.extractionMethod}
          />

          {/* Error display */}
          {analysis.error && analysis.currentStep === 'error' && (
            <ErrorDisplay error={analysis.error} className="mb-6" />
          )}

          {/* Results */}
          {hasResults && (
            <div className="space-y-6">
              {/* Extraction info */}
              {analysis.extractedText && (
                <ExtractionBadges
                  method={analysis.extractionMethod}
                  confidence={analysis.extractionConfidence}
                />
              )}

              {/* Extracted text */}
              {analysis.extractedText && (
                <Card className="p-4">
                  <h4 className="mb-2 text-sm font-medium">Extracted Text</h4>
                  <div className="max-h-64 overflow-y-auto rounded-md bg-secondary/50 p-3">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {analysis.extractedText}
                    </p>
                  </div>
                </Card>
              )}

              {/* Parsed document */}
              {analysis.document && <DocumentDataDisplay document={analysis.document} />}

              {/* Raw response */}
              {analysis.parseResponse && (
                <Card className="p-4">
                  <h4 className="mb-2 text-sm font-medium">Raw Response</h4>
                  <div className="max-h-48 overflow-y-auto rounded-md bg-secondary/50 p-3">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {analysis.parseResponse}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
