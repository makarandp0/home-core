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

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type SizeRange = 'all' | 'small' | 'medium' | 'large';

interface Filters {
  owner: string;
  documentType: string;
  category: string;
  sizeRange: SizeRange;
  expiryStatus: string;
}

interface FilterOptions {
  owners: string[];
  documentTypes: string[];
  categories: string[];
  hasNullOwner: boolean;
  hasNullType: boolean;
  hasNullCategory: boolean;
}

function getSizeRange(bytes: number): SizeRange {
  if (bytes < 100 * 1024) return 'small'; // < 100KB
  if (bytes < 1024 * 1024) return 'medium'; // < 1MB
  return 'large'; // >= 1MB
}

function getExpiryStatus(expiryDate: string | null): string {
  if (!expiryDate) return 'none';
  const expiry = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (expiry < now) return 'expired';
  if (expiry < thirtyDaysFromNow) return 'expiring-soon';
  return 'valid';
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = React.useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [confirmState, setConfirmState] = React.useState<{ id: string; countdown: number } | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<string, string | null>>({});

  const [filters, setFilters] = React.useState<Filters>({
    owner: 'all',
    documentType: 'all',
    category: 'all',
    sizeRange: 'all',
    expiryStatus: 'all',
  });

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

  // Lazy load thumbnails after documents are fetched
  React.useEffect(() => {
    if (documents.length === 0) return;

    async function fetchThumbnails() {
      const ids = documents.map((doc) => doc.id);
      try {
        const response = await fetch('/api/documents/thumbnails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
        const json = await response.json();
        if (json.ok && json.data) {
          setThumbnails(json.data);
        }
      } catch (error) {
        // Thumbnails are non-critical; log and continue
        console.error('Failed to fetch document thumbnails', error);
      }
    }

    fetchThumbnails();
  }, [documents]);

  React.useEffect(() => {
    if (!confirmState || confirmState.countdown <= 0) return;

    const timer = setInterval(() => {
      setConfirmState((s) => (s && s.countdown > 1 ? { ...s, countdown: s.countdown - 1 } : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [confirmState?.id, confirmState && confirmState.countdown > 0]);

  // Build filter options from documents
  const filterOptions = React.useMemo<FilterOptions>(() => {
    const owners = new Set<string>();
    const documentTypes = new Set<string>();
    const categories = new Set<string>();
    let hasNullOwner = false;
    let hasNullType = false;
    let hasNullCategory = false;

    documents.forEach((doc) => {
      if (doc.documentOwner) {
        owners.add(doc.documentOwner);
      } else {
        hasNullOwner = true;
      }
      if (doc.documentType) {
        documentTypes.add(doc.documentType);
      } else {
        hasNullType = true;
      }
      if (doc.category) {
        categories.add(doc.category);
      } else {
        hasNullCategory = true;
      }
    });

    return {
      owners: Array.from(owners).sort(),
      documentTypes: Array.from(documentTypes).sort(),
      categories: Array.from(categories).sort(),
      hasNullOwner,
      hasNullType,
      hasNullCategory,
    };
  }, [documents]);

  // Apply filters and compute expiry status once per document
  const filteredDocuments = React.useMemo(() => {
    return documents
      .map((doc) => ({
        ...doc,
        _expiryStatus: getExpiryStatus(doc.expiryDate),
      }))
      .filter((doc) => {
        // Handle "(not-set)" filter for null values
        if (filters.owner !== 'all') {
          if (filters.owner === '(not-set)') {
            if (doc.documentOwner) return false;
          } else if (doc.documentOwner !== filters.owner) {
            return false;
          }
        }
        if (filters.documentType !== 'all') {
          if (filters.documentType === '(not-set)') {
            if (doc.documentType) return false;
          } else if (doc.documentType !== filters.documentType) {
            return false;
          }
        }
        if (filters.category !== 'all') {
          if (filters.category === '(not-set)') {
            if (doc.category) return false;
          } else if (doc.category !== filters.category) {
            return false;
          }
        }
        if (filters.sizeRange !== 'all' && getSizeRange(doc.sizeBytes) !== filters.sizeRange) return false;
        if (filters.expiryStatus !== 'all' && doc._expiryStatus !== filters.expiryStatus) return false;
        return true;
      });
  }, [documents, filters]);

  const activeFilterCount = Object.values(filters).filter((v) => v !== 'all').length;

  function clearFilters() {
    setFilters({
      owner: 'all',
      documentType: 'all',
      category: 'all',
      sizeRange: 'all',
      expiryStatus: 'all',
    });
  }

  async function handleDelete(doc: DocumentMetadata, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirmState || confirmState.id !== doc.id) {
      setConfirmState({ id: doc.id, countdown: 3 });
      return;
    }

    setDeletingId(doc.id);
    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
      });
      const json = await response.json();

      if (!json.ok) {
        setError(json.error ?? 'Failed to delete document');
        return;
      }

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
      setConfirmState(null);
    }
  }

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
          Documents ({filteredDocuments.length}
          {activeFilterCount > 0 && ` of ${documents.length}`})
        </h2>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {/* Owner filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Owner
          </label>
          <select
            value={filters.owner}
            onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">All owners</option>
            {filterOptions.hasNullOwner && (
              <option value="(not-set)">(Not set)</option>
            )}
            {filterOptions.owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        {/* Document Type filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Type
          </label>
          <select
            value={filters.documentType}
            onChange={(e) => setFilters((f) => ({ ...f, documentType: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">All types</option>
            {filterOptions.hasNullType && (
              <option value="(not-set)">(Not set)</option>
            )}
            {filterOptions.documentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">All categories</option>
            {filterOptions.hasNullCategory && (
              <option value="(not-set)">(Not set)</option>
            )}
            {filterOptions.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Size filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Size
          </label>
          <select
            value={filters.sizeRange}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all' || value === 'small' || value === 'medium' || value === 'large') {
                setFilters((f) => ({ ...f, sizeRange: value }));
              }
            }}
            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">All sizes</option>
            <option value="small">&lt; 100 KB</option>
            <option value="medium">100 KB - 1 MB</option>
            <option value="large">&gt; 1 MB</option>
          </select>
        </div>

        {/* Expiry filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Expiry Status
          </label>
          <select
            value={filters.expiryStatus}
            onChange={(e) => setFilters((f) => ({ ...f, expiryStatus: e.target.value }))}
            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="all">All</option>
            <option value="expired">Expired</option>
            <option value="expiring-soon">Expiring soon (30 days)</option>
            <option value="valid">Valid</option>
            <option value="none">No expiry</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="w-12 px-2 py-2"></th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Document
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Owner
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Type / Category
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Size
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
                Dates
              </th>
              <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No documents match the selected filters
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => {
                const expiryStatus = doc._expiryStatus;
                const thumbnail = thumbnails[doc.id];
                const isPdf = doc.mimeType === 'application/pdf';
                return (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <td className="px-2 py-2">
                      <div className="w-10 h-10 flex items-center justify-center rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg
                            className="w-5 h-5 text-gray-400 dark:text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            {isPdf ? (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            ) : (
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            )}
                          </svg>
                        )}
                      </div>
                    </td>
                    {/* Document name + ID */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {doc.originalFilename}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                        {doc.id.slice(0, 8)}...
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {doc.documentOwner || '—'}
                    </td>

                    {/* Type + Category (stacked) */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {doc.documentType || '—'}
                      </div>
                      {doc.category && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.category}
                        </div>
                      )}
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatBytes(doc.sizeBytes)}
                    </td>

                    {/* Dates (stacked: created + expiry) */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(doc.createdAt)}
                      </div>
                      {doc.expiryDate && (
                        <div
                          className={`text-xs ${
                            expiryStatus === 'expired'
                              ? 'text-red-600 dark:text-red-400'
                              : expiryStatus === 'expiring-soon'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          Expires: {formatShortDate(doc.expiryDate)}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => handleDelete(doc, e)}
                        disabled={deletingId === doc.id}
                        className={`text-sm transition-colors disabled:opacity-50 ${
                          confirmState?.id === doc.id
                            ? 'text-red-700 dark:text-red-300 font-medium'
                            : 'text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400'
                        }`}
                      >
                        {deletingId === doc.id
                          ? 'Deleting...'
                          : confirmState?.id === doc.id
                            ? `Confirm? (${confirmState.countdown})`
                            : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
