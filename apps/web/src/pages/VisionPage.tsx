import * as React from 'react';
import {
  apiResponse,
  VisionResponseSchema,
  type VisionProvider,
  type DocumentData,
} from '@home/types';
import { Button } from '../components/Button';
import { compressImage } from '../utils/compressImage';

export function VisionPage() {
  const [image, setImage] = React.useState<string | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [provider, setProvider] = React.useState<VisionProvider>('anthropic');
  const [extractedText, setExtractedText] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<string | null>(null);
  const [document, setDocument] = React.useState<DocumentData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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

    setLoading(true);
    setError(null);
    setExtractedText(null);
    setResponse(null);
    setDocument(null);

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          provider,
          ...(prompt.trim() && { prompt: prompt.trim() }),
          ...(apiKey.trim() && { apiKey: apiKey.trim() }),
        }),
      });

      const json = await res.json();
      const parsed = apiResponse(VisionResponseSchema).parse(json);

      if (parsed.ok && parsed.data) {
        setExtractedText(parsed.data.extractedText);
        setResponse(parsed.data.response);
        setDocument(parsed.data.document ?? null);
      } else {
        setError(parsed.error ?? 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to call API');
    } finally {
      setLoading(false);
    }
  };

  const providerLabel = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
  const keyPlaceholder = provider === 'anthropic' ? 'sk-ant-...' : 'sk-...';

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-2 text-xl font-semibold dark:text-gray-100">Vision AI</h2>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Upload an image and ask questions about it using AI vision.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
            Provider
          </label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="provider"
                value="anthropic"
                checked={provider === 'anthropic'}
                onChange={() => setProvider('anthropic')}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Anthropic (Claude)
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="provider"
                value="openai"
                checked={provider === 'openai'}
                onChange={() => setProvider('openai')}
                className="h-4 w-4 text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">OpenAI (GPT-4o)</span>
            </label>
          </div>
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
          disabled={loading || !image}
          className={loading ? 'cursor-not-allowed opacity-50' : ''}
        >
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </Button>
      </form>

      {(extractedText || response || document) && (
        <div className="mt-8 space-y-6">
          {extractedText && (
            <div>
              <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                Extracted Text (OCR)
              </h3>
              <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-800">
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {extractedText}
                </p>
              </div>
            </div>
          )}

          {document && (
            <div>
              <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                Document Data
              </h3>
              <div className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <dl className="space-y-3">
                  <div className="flex items-start gap-2">
                    <dt className="w-32 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Type
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-gray-100">
                      {document.document_type}
                    </dd>
                  </div>
                  {document.name && (
                    <div className="flex items-start gap-2">
                      <dt className="w-32 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Name
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">{document.name}</dd>
                    </div>
                  )}
                  {document.expiry_date && (
                    <div className="flex items-start gap-2">
                      <dt className="w-32 shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Expiry Date
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-gray-100">
                        {document.expiry_date}
                      </dd>
                    </div>
                  )}
                  {document.fields && Object.keys(document.fields).length > 0 && (
                    <>
                      <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                        <dt className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Additional Fields
                        </dt>
                        <dd>
                          <dl className="space-y-2">
                            {Object.entries(document.fields).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <dt className="w-32 shrink-0 text-sm text-gray-600 dark:text-gray-300">
                                  {key}
                                </dt>
                                <dd className="text-sm text-gray-900 dark:text-gray-100">
                                  {value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            </div>
          )}

          {response && (
            <div>
              <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                Raw Response
              </h3>
              <div className="rounded-md bg-gray-100 p-4 dark:bg-gray-800">
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {response}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
