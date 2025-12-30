import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  type DocumentMetadata,
  DocumentListResponseSchema,
  ThumbnailsResponseSchema,
} from '@home/types';
import { DocumentCardView, type CardStyle } from '../components/documents';
import { api, getErrorMessage } from '@/lib/api';

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const CARD_STYLE_STORAGE_KEY = 'documents-card-style';

interface Filters {
  owner: string;
  documentType: string;
  category: string;
  expiryStatus: string;
  recent: boolean;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = React.useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [thumbnails, setThumbnails] = React.useState<Record<string, string | null>>({});
  const [cardStyle, setCardStyle] = React.useState<CardStyle>(() => {
    const stored = localStorage.getItem(CARD_STYLE_STORAGE_KEY);
    return stored === 'compact' ? 'compact' : 'minimal';
  });

  const [filters, setFilters] = React.useState<Filters>(() => ({
    owner: 'all',
    documentType: 'all',
    category: 'all',
    expiryStatus: 'all',
    recent: searchParams.get('recent') === 'true',
  }));

  // Persist card style to localStorage
  React.useEffect(() => {
    localStorage.setItem(CARD_STYLE_STORAGE_KEY, cardStyle);
  }, [cardStyle]);

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
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    return documents
      .map((doc) => ({
        ...doc,
        _expiryStatus: getExpiryStatus(doc.expiryDate),
      }))
      .filter((doc) => {
        // Recent filter: only show documents from last hour
        if (filters.recent) {
          if (new Date(doc.createdAt) < oneHourAgo) return false;
        }
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

  const activeFilterCount =
    Object.entries(filters).filter(([k, v]) => k === 'recent' ? v === true : v !== 'all').length;

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
      recent: false,
    });
    // Clear URL params
    setSearchParams({});
  }

  function toggleRecentFilter() {
    const newRecent = !filters.recent;
    setFilters((f) => ({ ...f, recent: newRecent }));
    if (newRecent) {
      setSearchParams({ recent: 'true' });
    } else {
      setSearchParams({});
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
        <div className="flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
          {/* View Style Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden dark:border-gray-600">
            <button
              onClick={() => setCardStyle('minimal')}
              className={`p-2 transition-colors ${
                cardStyle === 'minimal'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="Minimal view"
            >
              {/* Horizontal rows with small squares - represents minimal cards */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="4" height="4" rx="0.5" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeWidth={1.5} d="M9 5h12M9 7h8" />
                <rect x="3" y="10" width="4" height="4" rx="0.5" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeWidth={1.5} d="M9 11h12M9 13h8" />
                <rect x="3" y="16" width="4" height="4" rx="0.5" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeWidth={1.5} d="M9 17h12M9 19h8" />
              </svg>
            </button>
            <button
              onClick={() => setCardStyle('compact')}
              className={`p-2 transition-colors ${
                cardStyle === 'compact'
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
              title="Compact grid view"
            >
              {/* Grid of squares - represents compact cards */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg items-end">
        {/* Recently uploaded filter chip */}
        <button
          onClick={toggleRecentFilter}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            filters.recent
              ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
          }`}
        >
          Recently uploaded
        </button>

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

      {/* Document Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          No documents match the selected filters
        </div>
      ) : (
        <DocumentCardView
          documents={filteredDocuments}
          thumbnails={thumbnails}
          onNavigate={(id) => navigate(`/documents/${id}`, {
            state: { documentIds: documentIdList },
          })}
          formatShortDate={formatShortDate}
          cardStyle={cardStyle}
        />
      )}
    </div>
  );
}
