import * as React from 'react';
import { Button } from '../components/Button';
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
      <h2 className="mb-2 text-xl font-semibold dark:text-gray-100">Document Analysis</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Upload an image or PDF to extract and parse document data.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Provider
          </label>
          {providers.loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading providers...</div>
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
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{p.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            File (Image or PDF)
          </label>
          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={fileUpload.handleFileChange}
            className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-gray-700 dark:file:text-gray-200 dark:hover:file:bg-gray-600"
          />
          {fileUpload.file && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Selected: {fileUpload.file.name} ({fileUpload.fileType?.toUpperCase()})
            </div>
          )}
          {fileUpload.filePreview && (
            <div className="mt-4">
              <img
                src={fileUpload.filePreview}
                alt="Preview"
                className="max-h-64 rounded-lg border border-gray-200 dark:border-gray-700"
              />
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Prompt{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Custom instructions for parsing. Leave empty for default document extraction."
            rows={3}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            {providerLabel} API Key{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyPlaceholder}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
          className={analysis.isProcessing ? 'cursor-not-allowed opacity-50' : ''}
        >
          {analysis.isProcessing ? 'Processing...' : 'Analyze Document'}
        </Button>
      </form>

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
                  usedLLMExtraction={analysis.usedLLMExtraction}
                />
              )}

              {/* Extracted text */}
              {analysis.extractedText && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Extracted Text
                  </h4>
                  <div className="max-h-64 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                    <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      {analysis.extractedText}
                    </p>
                  </div>
                </div>
              )}

              {/* Parsed document */}
              {analysis.document && <DocumentDataDisplay document={analysis.document} />}

              {/* Raw response */}
              {analysis.parseResponse && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Raw Response
                  </h4>
                  <div className="max-h-48 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                    <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      {analysis.parseResponse}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
