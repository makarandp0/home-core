import * as React from 'react';
import {
  apiResponse,
  VisionExtractTextResponseSchema,
  VisionParseResponseSchema,
  ProvidersResponseSchema,
  DocumentProcessResponseSchema,
  type ProviderInfo,
  type DocumentData,
  type ExtractionMethod,
  type ApiError,
} from '@home/types';
import { Button } from '../components/Button';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { compressImage } from '../utils/compressImage';
import { makAssert } from '@home/utils';

// Confidence threshold for LLM re-extraction (80%)
const CONFIDENCE_THRESHOLD = 0.8;

type ProcessingStep = 'idle' | 'extracting' | 'reextracting' | 'parsing' | 'complete' | 'error';

interface StepStatus {
  extracting: 'pending' | 'active' | 'complete' | 'error';
  reextracting: 'pending' | 'active' | 'complete' | 'skipped';
  parsing: 'pending' | 'active' | 'complete' | 'error';
}

export function VisionPage() {
  // Provider state
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = React.useState(true);
  const [provider, setProvider] = React.useState<string>('');
  const [apiKey, setApiKey] = React.useState('');
  const [prompt, setPrompt] = React.useState('');

  // File state
  const [file, setFile] = React.useState<File | null>(null);
  const [fileType, setFileType] = React.useState<'image' | 'pdf' | null>(null);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [fileDataUrl, setFileDataUrl] = React.useState<string | null>(null);

  // Processing state
  const [currentStep, setCurrentStep] = React.useState<ProcessingStep>('idle');
  const [stepStatus, setStepStatus] = React.useState<StepStatus>({
    extracting: 'pending',
    reextracting: 'pending',
    parsing: 'pending',
  });

  // Results state
  const [extractedText, setExtractedText] = React.useState<string | null>(null);
  const [extractionMethod, setExtractionMethod] = React.useState<ExtractionMethod | null>(null);
  const [extractionConfidence, setExtractionConfidence] = React.useState<number | null>(null);
  const [usedLLMExtraction, setUsedLLMExtraction] = React.useState(false);
  const [document, setDocument] = React.useState<DocumentData | null>(null);
  const [parseResponse, setParseResponse] = React.useState<string | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);

  // Fetch providers on mount
  React.useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        const json = await res.json();
        const parsed = apiResponse(ProvidersResponseSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviders(parsed.data.providers);
          if (parsed.data.providers.length > 0) {
            setProvider(parsed.data.providers[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      } finally {
        setProvidersLoading(false);
      }
    }
    fetchProviders();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isPdf = selectedFile.type === 'application/pdf';
    const isImage = selectedFile.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setError('Please select an image or PDF file');
      return;
    }

    setError(null);
    setFile(selectedFile);
    setFileType(isPdf ? 'pdf' : 'image');

    // Reset results
    resetResults();

    if (isImage) {
      try {
        const compressed = await compressImage(selectedFile);
        setFilePreview(compressed);
        setFileDataUrl(compressed);
      } catch {
        setError('Failed to process image file');
      }
    } else {
      // For PDFs, read as base64
      setFilePreview(null);
      const reader = new FileReader();
      reader.onload = () => {
        makAssert(typeof reader.result === 'string', 'Expected string from readAsDataURL');
        setFileDataUrl(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const resetResults = () => {
    setCurrentStep('idle');
    setStepStatus({
      extracting: 'pending',
      reextracting: 'pending',
      parsing: 'pending',
    });
    setExtractedText(null);
    setExtractionMethod(null);
    setExtractionConfidence(null);
    setUsedLLMExtraction(false);
    setDocument(null);
    setParseResponse(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !fileDataUrl) {
      setError('Please select a file');
      return;
    }

    resetResults();
    setCurrentStep('extracting');
    setStepStatus((s) => ({ ...s, extracting: 'active' }));

    try {
      // Step 1: Extract text using doc_processor
      const base64Content = fileDataUrl.replace(/^data:[^;]+;base64,/, '');

      const docRes = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64Content,
          filename: file.name,
        }),
      });

      const docJson = await docRes.json();
      const docParsed = DocumentProcessResponseSchema.parse(docJson);

      if (!docParsed.ok || !docParsed.data) {
        setError(docParsed.error ?? 'Failed to extract text');
        throw new Error('extraction_failed');
      }

      let finalText = docParsed.data.text;
      setExtractedText(finalText);
      setExtractionMethod(docParsed.data.method);
      setExtractionConfidence(docParsed.data.confidence ?? null);
      setStepStatus((s) => ({ ...s, extracting: 'complete' }));

      // Step 2: Check if LLM re-extraction is needed
      const needsReextraction =
        fileType === 'image' &&
        docParsed.data.method === 'ocr' &&
        (docParsed.data.confidence ?? 0) < CONFIDENCE_THRESHOLD;

      if (needsReextraction) {
        setCurrentStep('reextracting');
        setStepStatus((s) => ({ ...s, reextracting: 'active' }));

        const extractRes = await fetch('/api/vision/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: fileDataUrl,
            provider,
            ...(apiKey.trim() && { apiKey: apiKey.trim() }),
          }),
        });

        const extractJson = await extractRes.json();
        const extractParsed = apiResponse(VisionExtractTextResponseSchema).parse(extractJson);

        if (!extractParsed.ok || !extractParsed.data) {
          setError(extractParsed.error ?? 'Failed to extract text with LLM');
          throw new Error('llm_extraction_failed');
        }

        finalText = extractParsed.data.extractedText;
        setExtractedText(finalText);
        setUsedLLMExtraction(true);
        setStepStatus((s) => ({ ...s, reextracting: 'complete' }));
      } else {
        setStepStatus((s) => ({ ...s, reextracting: 'skipped' }));
      }

      // Step 3: Parse text to JSON
      setCurrentStep('parsing');
      setStepStatus((s) => ({ ...s, parsing: 'active' }));

      const parseRes = await fetch('/api/vision/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: finalText,
          provider,
          ...(apiKey.trim() && { apiKey: apiKey.trim() }),
          ...(prompt.trim() && { prompt: prompt.trim() }),
        }),
      });

      const parseJson = await parseRes.json();
      const parseParsed = apiResponse(VisionParseResponseSchema).parse(parseJson);

      if (!parseParsed.ok || !parseParsed.data) {
        setError(parseParsed.error ?? 'Failed to parse document');
        throw new Error('parse_failed');
      }

      setDocument(parseParsed.data.document ?? null);
      setParseResponse(parseParsed.data.response);
      setStepStatus((s) => ({ ...s, parsing: 'complete' }));
      setCurrentStep('complete');
    } catch (err) {
      // Only set error if not already set by API response handling
      if (!error) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      setCurrentStep('error');

      // Mark current active step as error
      setStepStatus((s) => {
        if (s.extracting === 'active') return { ...s, extracting: 'error' };
        if (s.reextracting === 'active')
          return { ...s, reextracting: 'skipped', parsing: 'pending' };
        if (s.parsing === 'active') return { ...s, parsing: 'error' };
        return s;
      });
    }
  };

  const providerMeta = providers.find((p) => p.id === provider);
  const providerLabel = providerMeta?.label?.split(' ')[0] ?? 'Provider';
  const keyPlaceholder = providerMeta?.placeholder ?? '';

  const isProcessing = ['extracting', 'reextracting', 'parsing'].includes(currentStep);
  const hasResults = extractedText || document || parseResponse;

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
          {providersLoading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading providers...</div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {providers.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={provider === p.id}
                    onChange={() => setProvider(p.id)}
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
            onChange={handleFileChange}
            className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-gray-700 dark:file:text-gray-200 dark:hover:file:bg-gray-600"
          />
          {file && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Selected: {file.name} ({fileType?.toUpperCase()})
            </div>
          )}
          {filePreview && (
            <div className="mt-4">
              <img
                src={filePreview}
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

        {error && currentStep !== 'error' && <ErrorDisplay error={error} />}

        <Button
          type="submit"
          disabled={isProcessing || !file || !provider || providersLoading}
          className={isProcessing ? 'cursor-not-allowed opacity-50' : ''}
        >
          {isProcessing ? 'Processing...' : 'Analyze Document'}
        </Button>
      </form>

      {/* Step Progress Indicator */}
      {currentStep !== 'idle' && (
        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <StepIndicator
              label="1. Extract Text"
              status={stepStatus.extracting}
              sublabel={extractionMethod ? `(${extractionMethod})` : undefined}
            />
            <div className="h-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
            <StepIndicator
              label="2. Re-extract"
              status={stepStatus.reextracting}
              sublabel={stepStatus.reextracting === 'skipped' ? '(skipped)' : undefined}
            />
            <div className="h-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
            <StepIndicator label="3. Parse JSON" status={stepStatus.parsing} />
          </div>

          {/* Error display */}
          {error && currentStep === 'error' && <ErrorDisplay error={error} className="mb-6" />}

          {/* Results */}
          {hasResults && (
            <div className="space-y-6">
              {/* Extraction info */}
              {extractedText && (
                <div className="flex flex-wrap gap-2">
                  {extractionMethod && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      Extraction: {extractionMethod}
                    </span>
                  )}
                  {extractionConfidence !== null && (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        extractionConfidence >= CONFIDENCE_THRESHOLD
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}
                    >
                      Confidence: {(extractionConfidence * 100).toFixed(1)}%
                    </span>
                  )}
                  {usedLLMExtraction && (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      LLM Re-extracted
                    </span>
                  )}
                </div>
              )}

              {/* Extracted text */}
              {extractedText && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Extracted Text
                  </h4>
                  <div className="max-h-64 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                    <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      {extractedText}
                    </p>
                  </div>
                </div>
              )}

              {/* Parsed document */}
              {document && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Document Data
                  </h4>
                  <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <dl className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">
                          Type
                        </dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {document.document_type}
                        </dd>
                      </div>
                      {document.id && (
                        <div className="flex items-start gap-2">
                          <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">
                            ID
                          </dt>
                          <dd className="text-gray-900 dark:text-gray-100">{document.id}</dd>
                        </div>
                      )}
                      {document.name && (
                        <div className="flex items-start gap-2">
                          <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">
                            Name
                          </dt>
                          <dd className="text-gray-900 dark:text-gray-100">{document.name}</dd>
                        </div>
                      )}
                      {document.expiry_date && (
                        <div className="flex items-start gap-2">
                          <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">
                            Expiry
                          </dt>
                          <dd className="text-gray-900 dark:text-gray-100">
                            {document.expiry_date}
                          </dd>
                        </div>
                      )}
                      {document.fields && Object.keys(document.fields).length > 0 && (
                        <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
                          <dt className="mb-1 font-medium text-gray-500 dark:text-gray-400">
                            Fields
                          </dt>
                          <dd>
                            <dl className="space-y-1">
                              {Object.entries(document.fields).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-2">
                                  <dt className="w-24 shrink-0 text-gray-600 dark:text-gray-300">
                                    {key}
                                  </dt>
                                  <dd className="text-gray-900 dark:text-gray-100">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}

              {/* Raw response */}
              {parseResponse && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Raw Response
                  </h4>
                  <div className="max-h-48 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                    <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                      {parseResponse}
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

function StepIndicator({
  label,
  status,
  sublabel,
}: {
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error' | 'skipped';
  sublabel?: string;
}) {
  const getStatusStyles = () => {
    switch (status) {
      case 'active':
        return 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'complete':
        return 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'error':
        return 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'skipped':
        return 'border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500';
      default:
        return 'border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'active':
        return (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
        );
      case 'complete':
        return (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'skipped':
        return <span className="text-xs">-</span>;
      default:
        return <span className="h-2 w-2 rounded-full bg-current" />;
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${getStatusStyles()}`}
      >
        {getIcon()}
      </div>
      <span className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {sublabel && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{sublabel}</span>
      )}
    </div>
  );
}
