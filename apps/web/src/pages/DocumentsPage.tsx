import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type DocumentMetadata,
  DocumentListResponseSchema,
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

export function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = React.useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchDocuments() {
      try {
        const response = await fetch('/api/documents');
        const json = await response.json();

        const parsed = apiResponse(DocumentListResponseSchema).safeParse(json);
        if (!parsed.success || !parsed.data.ok || !parsed.data.data) {
          setError(parsed.data?.error ?? 'Failed to fetch documents');
          return;
        }

        setDocuments(parsed.data.data.documents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch documents');
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-600 dark:text-gray-400">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            No Documents
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Upload documents via the Vision page to see them here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
          Documents ({documents.length})
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Name
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Type
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Size
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}`)}
                className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {doc.originalFilename}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {doc.id}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {doc.documentType || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatBytes(doc.sizeBytes)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(doc.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
