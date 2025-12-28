import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type DocumentMetadata,
  DocumentListResponseSchema,
  ThumbnailsResponseSchema,
} from '@home/types';
import { DocumentListView, DocumentCardView } from '../components/documents';
import { api, getErrorMessage } from '@/lib/api';

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

type ViewMode = 'list' | 'card';

const VIEW_MODE_STORAGE_KEY = 'documents-view-mode';

interface Filters {
  owner: string;
  documentType: string;
  category: string;
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
  const [thumbnails, setThumbnails] = React.useState<Record<string, string | null>>({});
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === 'card' ? 'card' : 'list';
  });

  const [filters, setFilters] = React.useState<Filters>({
    owner: 'all',
    documentType: 'all',
    category: 'all',
    expiryStatus: 'all',
  });

  // Persist view mode to localStorage
  React.useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  React.useEffect(() => {
    async function fetchDocuments() {
      const result = await api.get('/api/documents', DocumentListResponseSchema);
      if (result.ok) {
        setDocuments(result.data.documents);
      } else {
        setError(getErrorMessage(result.error));
      }
      setLoading(false);
    }

    fetchDocuments();
  }, []);

  // Lazy load thumbnails after documents are fetched
  React.useEffect(() => {
    if (documents.length === 0) return;

    async function fetchThumbnails() {
      const ids = documents.map((doc) => doc.id);
      const result = await api.post('/api/documents/thumbnails', ThumbnailsResponseSchema, { ids });
      if (result.ok) {
        setThumbnails(result.data);
      } else {
        // Thumbnails are non-critical; log and continue
        console.error('Failed to fetch document thumbnails:', getErrorMessage(result.error));
      }
    }

    fetchThumbnails();
  }, [documents]);

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
        if (filters.expiryStatus !== 'all' && doc._expiryStatus !== filters.expiryStatus) return false;
        return true;
      });
  }, [documents, filters]);

  const activeFilterCount = Object.values(filters).filter((v) => v !== 'all').length;

  // Memoize document ID list for navigation state
  const documentIdList = React.useMemo(
    () => filteredDocuments.map((d) => d.id),
    [filteredDocuments]
  );

  function clearFilters() {
    setFilters({
      owner: 'all',
      documentType: 'all',
      category: 'all',
      expiryStatus: 'all',
    });
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
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden dark:border-gray-600">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="List view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 transition-colors ${
                viewMode === 'card'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="Card view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            </button>
          </div>
        </div>
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

      {/* Empty State */}
      {filteredDocuments.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          No documents match the selected filters
        </div>
      ) : viewMode === 'list' ? (
        <DocumentListView
          documents={filteredDocuments}
          thumbnails={thumbnails}
          onNavigate={(id) => navigate(`/documents/${id}`, {
            state: { documentIds: documentIdList },
          })}
          formatDate={formatDate}
          formatShortDate={formatShortDate}
        />
      ) : (
        <DocumentCardView
          documents={filteredDocuments}
          thumbnails={thumbnails}
          onNavigate={(id) => navigate(`/documents/${id}`, {
            state: { documentIds: documentIdList },
          })}
          formatShortDate={formatShortDate}
        />
      )}
    </div>
  );
}
