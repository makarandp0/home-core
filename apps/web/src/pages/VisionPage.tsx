import * as React from 'react';
import {
  apiResponse,
  VisionResponseSchema,
  ProvidersResponseSchema,
  DocumentProcessResponseSchema,
  type ProviderInfo,
  type DocumentData,
  type ExtractionMethod,
} from '@home/types';
import { Button } from '../components/Button';
import { compressImage } from '../utils/compressImage';

export function VisionPage() {
  const [providers, setProviders] = React.useState<ProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = React.useState(true);
  const [image, setImage] = React.useState<string | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [provider, setProvider] = React.useState<string>('');
  // LLM Vision state
  const [extractedText, setExtractedText] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<string | null>(null);
  const [document, setDocument] = React.useState<DocumentData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  // Doc Processor state
  const [docProcessorText, setDocProcessorText] = React.useState<string | null>(null);
  const [docProcessorMethod, setDocProcessorMethod] = React.useState<ExtractionMethod | null>(null);
  const [docProcessorConfidence, setDocProcessorConfidence] = React.useState<number | null>(null);
  const [docProcessorError, setDocProcessorError] = React.useState<string | null>(null);
  const [docProcessorLoading, setDocProcessorLoading] = React.useState(false);

  // Fetch providers from API on mount
  React.useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        const json = await res.json();
        const parsed = apiResponse(ProvidersResponseSchema).parse(json);
        if (parsed.ok && parsed.data) {
          setProviders(parsed.data.providers);
          // Default to first provider
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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    try {
      setError(null);
      const compressed = await compressImage(file);
      setImage(compressed);
      setImagePreview(compressed);
    } catch {
      setError('Failed to process image file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!image) {
      setError('Please select an image');
      return;
    }

    // Reset LLM state
    setLoading(true);
    setError(null);
    setExtractedText(null);
    setResponse(null);
    setDocument(null);

    // Reset doc processor state
    setDocProcessorLoading(true);
    setDocProcessorError(null);
    setDocProcessorText(null);
    setDocProcessorMethod(null);
    setDocProcessorConfidence(null);

    // Extract base64 content and determine filename from data URL
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
    const extension = mimeType.split('/')[1] ?? 'jpeg';
    const base64Content = image.replace(/^data:image\/\w+;base64,/, '');

    // Call both APIs in parallel
    const visionPromise = fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        provider,
        ...(prompt.trim() && { prompt: prompt.trim() }),
        ...(apiKey.trim() && { apiKey: apiKey.trim() }),
      }),
    });

    const docProcessorPromise = fetch('/api/documents/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: base64Content,
        filename: `image.${extension}`,
      }),
    });

    // Handle LLM Vision response
    visionPromise
      .then(async (res) => {
        const json = await res.json();
        const parsed = apiResponse(VisionResponseSchema).parse(json);

        if (parsed.ok && parsed.data) {
          setExtractedText(parsed.data.extractedText);
          setResponse(parsed.data.response);
          setDocument(parsed.data.document ?? null);
        } else {
          setError(parsed.error ?? 'Unknown error occurred');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to call Vision API');
      })
      .finally(() => {
        setLoading(false);
      });

    // Handle Doc Processor response
    docProcessorPromise
      .then(async (res) => {
        const json = await res.json();
        const parsed = DocumentProcessResponseSchema.parse(json);

        if (parsed.ok && parsed.data) {
          setDocProcessorText(parsed.data.text);
          setDocProcessorMethod(parsed.data.method);
          setDocProcessorConfidence(parsed.data.confidence ?? null);
        } else {
          setDocProcessorError(parsed.error ?? 'Doc processor error');
        }
      })
      .catch((err) => {
        setDocProcessorError(
          err instanceof Error ? err.message : 'Failed to call Doc Processor'
        );
      })
      .finally(() => {
        setDocProcessorLoading(false);
      });
  };

  const providerMeta = providers.find((p) => p.id === provider);
  const providerLabel = providerMeta?.label?.split(' ')[0] ?? 'Provider';
  const keyPlaceholder = providerMeta?.placeholder ?? '';

  const hasLLMResults = extractedText || response || document;
  const hasDocProcessorResults = docProcessorText;
  const hasAnyResults = hasLLMResults || hasDocProcessorResults || loading || docProcessorLoading;

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="mb-2 text-xl font-semibold dark:text-gray-100">Vision AI</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Upload an image and compare LLM vision with doc processor OCR side-by-side.
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
            Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full cursor-pointer text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-gray-700 dark:file:text-gray-200 dark:hover:file:bg-gray-600"
          />
          {imagePreview && (
            <div className="mt-4">
              <img
                src={imagePreview}
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
            placeholder="What would you like to know about this image? Leave empty for document extraction."
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

        {error && (
          <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !image || !provider || providersLoading}
          className={loading ? 'cursor-not-allowed opacity-50' : ''}
        >
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </Button>
      </form>

      {hasAnyResults && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LLM Vision Column */}
          <div className="space-y-4">
            <h3 className="border-b border-gray-200 pb-2 text-lg font-medium text-gray-900 dark:border-gray-700 dark:text-gray-100">
              LLM Vision ({providerMeta?.label ?? 'Provider'})
            </h3>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                Analyzing with LLM...
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {extractedText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extracted Text (OCR)
                </h4>
                <div className="max-h-64 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {extractedText}
                  </p>
                </div>
              </div>
            )}

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
                        <dd className="text-gray-900 dark:text-gray-100">{document.expiry_date}</dd>
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

            {response && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Raw Response
                </h4>
                <div className="max-h-48 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {response}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Doc Processor Column */}
          <div className="space-y-4">
            <h3 className="border-b border-gray-200 pb-2 text-lg font-medium text-gray-900 dark:border-gray-700 dark:text-gray-100">
              Doc Processor (EasyOCR)
            </h3>

            {docProcessorLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                Processing with OCR...
              </div>
            )}

            {docProcessorError && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-400">{docProcessorError}</p>
              </div>
            )}

            {docProcessorMethod && (
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  Method: {docProcessorMethod}
                </span>
                {docProcessorConfidence !== null && (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    Confidence: {(docProcessorConfidence * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )}

            {docProcessorText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extracted Text
                </h4>
                <div className="max-h-96 overflow-y-auto rounded-md bg-gray-100 p-3 dark:bg-gray-800">
                  <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                    {docProcessorText}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
