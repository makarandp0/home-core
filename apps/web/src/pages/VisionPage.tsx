import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { StepProgress } from '../components/StepProgress';
import { DocumentDataDisplay } from '../components/DocumentDataDisplay';
import { ExtractionBadges } from '../components/ExtractionBadges';
import { JsonDisplay } from '../components/JsonDisplay';
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
      <Card className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Collapsible title="Settings" className="bg-secondary/20">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Custom Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Custom instructions for parsing. Leave empty for default."
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{providerLabel} API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={keyPlaceholder}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use server-configured key.
                </p>
              </div>
            </div>
          </Collapsible>

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

          {/* Step Progress Indicator */}
          {analysis.currentStep !== 'idle' && (
            <StepProgress
              statuses={analysis.stepStatus}
              extractionMethod={analysis.extractionMethod}
            />
          )}

          {/* Error display */}
          {analysis.error && analysis.currentStep === 'error' && (
            <ErrorDisplay error={analysis.error} />
          )}
        </form>
      </Card>

      {/* Results */}
      {hasResults && (
        <div className="mt-6 space-y-3">
          {/* JSON Response - shown prominently */}
          {analysis.parseResponse && <JsonDisplay data={analysis.parseResponse} />}

          {/* Extraction info badges */}
          {analysis.extractedText && (
            <ExtractionBadges
              method={analysis.extractionMethod}
              confidence={analysis.extractionConfidence}
            />
          )}

          {/* Extracted text - collapsible */}
          {analysis.extractedText && (
            <Collapsible title="Extracted Text">
              <div className="max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {analysis.extractedText}
                </p>
              </div>
            </Collapsible>
          )}

          {/* Parsed document - collapsible */}
          {analysis.document && (
            <Collapsible title="Document Data">
              <DocumentDataDisplay document={analysis.document} />
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
