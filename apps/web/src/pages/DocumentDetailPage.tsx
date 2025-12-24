import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  type DocumentMetadata,
  DocumentMetadataSchema,
  apiResponse,
} from '@home/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = React.useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchDocument() {
      if (!id) return;

      try {
        const response = await fetch(`/api/documents/${id}`);
        const json = await response.json();

        const parsed = apiResponse(DocumentMetadataSchema).safeParse(json);
        if (!parsed.success || !parsed.data.ok || !parsed.data.data) {
          setError(parsed.data?.error ?? 'Failed to fetch document');
          return;
        }

        setDocument(parsed.data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch document');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-600 dark:text-gray-400">Loading document...</div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">{error ?? 'Document not found'}</div>
          <button
            onClick={() => navigate('/documents')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  const isImage = document.mimeType.startsWith('image/');
  const isPdf = document.mimeType === 'application/pdf';
  const fileUrl = `/api/documents/${document.id}/file`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/documents')}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          ← Back
        </button>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          {document.originalFilename}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document preview */}
        <div className="lg:col-span-2">
          <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
            {isImage && (
              <img
                src={fileUrl}
                alt={document.originalFilename}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            )}
            {isPdf && (
              <iframe
                src={fileUrl}
                title={document.originalFilename}
                className="w-full h-[70vh]"
              />
            )}
            {!isImage && !isPdf && (
              <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                Preview not available for this file type
              </div>
            )}
          </div>
        </div>

        {/* Document metadata */}
        <div className="space-y-4">
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">File name</dt>
                <dd className="text-gray-900 dark:text-gray-100">{document.originalFilename}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="text-gray-900 dark:text-gray-100">{document.mimeType}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Size</dt>
                <dd className="text-gray-900 dark:text-gray-100">{formatBytes(document.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="text-gray-900 dark:text-gray-100">{formatDate(document.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Document ID</dt>
                <dd className="text-gray-900 dark:text-gray-100 text-xs break-all">{document.id}</dd>
              </div>
              {document.documentType && (
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Document Type</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{document.documentType}</dd>
                </div>
              )}
              {document.expiryDate && (
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Expiry Date</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{document.expiryDate}</dd>
                </div>
              )}
            </dl>
          </div>

          <a
            href={fileUrl}
            download={document.originalFilename}
            className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
