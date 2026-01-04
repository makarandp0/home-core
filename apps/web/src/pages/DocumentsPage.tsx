import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type DocumentMetadata,
  DocumentListResponseSchema,
  ThumbnailsResponseSchema,
} from '@ohs/types';
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
  recent: string;
}

// Time options for "recently uploaded" filter (in milliseconds)
const RECENT_OPTIONS: { value: string; label: string; ms: number }[] = [
  { value: 'all', label: 'Any time', ms: 0 },
  { value: '10min', label: 'Last 10 minutes', ms: 10 * 60 * 1000 },
  { value: '1hour', label: 'Last hour', ms: 60 * 60 * 1000 },
  { value: '1day', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '1week', label: 'Last week', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '1month', label: 'Last month', ms: 30 * 24 * 60 * 60 * 1000 },
];

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

  const [filters, setFilters] = React.useState<Filters>(() => {
    const recentParam = searchParams.get('recent');
    // Support both old format (recent=true) and new format (recent=10min)
    const recentValue = recentParam === 'true' ? '1hour' : (recentParam ?? 'all');
    return {
      owner: 'all',
      documentType: 'all',
      category: 'all',
      expiryStatus: 'all',
      recent: RECENT_OPTIONS.some(opt => opt.value === recentValue) ? recentValue : 'all',
    };
  });

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
    const recentOption = RECENT_OPTIONS.find(opt => opt.value === filters.recent);
    const recentThreshold = recentOption?.ms
      ? new Date(Date.now() - recentOption.ms)
      : null;

    return documents
      .map((doc) => ({
        ...doc,
        _expiryStatus: getExpiryStatus(doc.expiryDate),
      }))
      .filter((doc) => {
        // Recent filter: only show documents within selected time range
        if (recentThreshold && new Date(doc.createdAt) < recentThreshold) {
          return false;
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
    Object.values(filters).filter((v) => v !== 'all').length;

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
      recent: 'all',
    });
    // Clear URL params
    setSearchParams({});
  }

  function handleRecentChange(value: string) {
    setFilters((f) => ({ ...f, recent: value }));
    if (value !== 'all') {
      setSearchParams({ recent: value });
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
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Upload your first document to get started.
          </p>
          <Button asChild>
            <Link to="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Link>
          </Button>
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
          <Button size="sm" asChild>
            <Link to="/upload">
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Link>
          </Button>
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
        {/* Recently uploaded filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Uploaded
          </label>
          <select
            value={filters.recent}
            onChange={(e) => handleRecentChange(e.target.value)}
            className="px-2 py-1.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            {RECENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

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
