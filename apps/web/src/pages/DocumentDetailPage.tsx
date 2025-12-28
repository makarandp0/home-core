import * as React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  type DocumentMetadata,
  DocumentMetadataSchema,
  DeleteResponseSchema,
} from '@home/types';
import { api, getErrorMessage } from '@/lib/api';

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

interface LocationState {
  documentIds?: string[];
}

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [document, setDocument] = React.useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmCountdown, setConfirmCountdown] = React.useState(0);
  const [documentIds, setDocumentIds] = React.useState<string[]>([]);

  // Get document IDs from router state (passed from filtered list)
  // If accessed directly via URL, navigation will be disabled
  React.useEffect(() => {
    const state: LocationState | null = location.state;
    if (state?.documentIds && state.documentIds.length > 0) {
      setDocumentIds(state.documentIds);
    } else {
      setDocumentIds([]);
    }
  }, [location.key]);

  React.useEffect(() => {
    async function fetchDocument() {
      if (!id) return;

      const result = await api.get(`/api/documents/${id}`, DocumentMetadataSchema);
      if (result.ok) {
        setDocument(result.data);
      } else {
        setError(getErrorMessage(result.error));
      }
      setLoading(false);
    }

    fetchDocument();
  }, [id]);

  // Calculate prev/next document IDs
  const currentIndex = id ? documentIds.indexOf(id) : -1;
  const prevDocId = currentIndex > 0 ? documentIds[currentIndex - 1] : null;
  const nextDocId = currentIndex >= 0 && currentIndex < documentIds.length - 1 ? documentIds[currentIndex + 1] : null;

  React.useEffect(() => {
    if (confirmCountdown <= 0) return;

    const timer = setInterval(() => {
      setConfirmCountdown((c) => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [confirmCountdown > 0]);

  async function handleDelete() {
    if (!document) return;

    if (confirmCountdown === 0) {
      setConfirmCountdown(3);
      return;
    }

    setDeleting(true);
    const result = await api.delete(`/api/documents/${document.id}`, DeleteResponseSchema);
    if (result.ok) {
      navigate('/documents');
    } else {
      setError(getErrorMessage(result.error));
    }
    setDeleting(false);
    setConfirmCountdown(0);
  }

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
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/documents')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span aria-hidden="true">←</span>
          <span>Back to Documents</span>
        </button>

        {documentIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevDocId && navigate(`/documents/${prevDocId}`, {
                state: { documentIds },
              })}
              disabled={!prevDocId}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:disabled:hover:text-gray-400"
              title={prevDocId ? 'Previous document' : 'No previous document'}
            >
              <span aria-hidden="true">←</span>
              <span>Previous</span>
            </button>

            <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
              {currentIndex === -1
                ? 'Position unknown'
                : `${currentIndex + 1} / ${documentIds.length}`}
            </span>

            <button
              onClick={() => nextDocId && navigate(`/documents/${nextDocId}`, {
                state: { documentIds },
              })}
              disabled={!nextDocId}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:disabled:hover:text-gray-400"
              title={nextDocId ? 'Next document' : 'No next document'}
            >
              <span>Next</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
        {document.originalFilename}
      </h2>

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

          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`block w-full text-center px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              confirmCountdown > 0
                ? 'bg-red-700 text-white hover:bg-red-800'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-600 hover:text-white dark:hover:bg-red-600'
            }`}
          >
            {deleting ? 'Deleting...' : confirmCountdown > 0 ? `Confirm? (${confirmCountdown})` : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
