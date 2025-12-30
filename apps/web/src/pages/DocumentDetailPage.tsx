import * as React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  type DocumentMetadata,
  DocumentMetadataSchema,
  DeleteResponseSchema,
} from '@home/types';
import { api, getErrorMessage } from '@/lib/api';
import { OwnerNameAutocomplete } from '@/components/OwnerNameAutocomplete';

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
  const [navigating, setNavigating] = React.useState<'prev' | 'next' | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    originalFilename: '',
    documentOwner: '',
    documentType: '',
    category: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

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

      setLoading(true);
      const result = await api.get(`/api/documents/${id}`, DocumentMetadataSchema);
      if (result.ok) {
        setDocument(result.data);
      } else {
        setError(getErrorMessage(result.error));
      }
      setLoading(false);
      setNavigating(null);
    }

    fetchDocument();
  }, [id]);

  // Sync edit form when document loads or changes
  React.useEffect(() => {
    if (document) {
      setEditForm({
        originalFilename: document.originalFilename,
        documentOwner: document.documentOwner ?? '',
        documentType: document.documentType ?? '',
        category: document.category ?? '',
      });
    }
  }, [document]);

  // Edit mode handlers
  function handleEditToggle() {
    if (isEditMode) {
      // Cancel: reset form to current document values
      if (document) {
        setEditForm({
          originalFilename: document.originalFilename,
          documentOwner: document.documentOwner ?? '',
          documentType: document.documentType ?? '',
          category: document.category ?? '',
        });
      }
      setSaveError(null);
    }
    setIsEditMode(!isEditMode);
  }

  async function handleSave() {
    if (!document) return;

    setSaving(true);
    setSaveError(null);

    // Build update payload - only include changed fields
    const updates: Record<string, string | null> = {};

    if (editForm.originalFilename !== document.originalFilename) {
      updates.originalFilename = editForm.originalFilename;
    }
    if (editForm.documentOwner !== (document.documentOwner ?? '')) {
      updates.documentOwner = editForm.documentOwner || null;
    }
    if (editForm.documentType !== (document.documentType ?? '')) {
      updates.documentType = editForm.documentType || null;
    }
    if (editForm.category !== (document.category ?? '')) {
      updates.category = editForm.category || null;
    }

    // Skip if no changes
    if (Object.keys(updates).length === 0) {
      setIsEditMode(false);
      setSaving(false);
      return;
    }

    const result = await api.patch(
      `/api/documents/${document.id}`,
      DocumentMetadataSchema,
      updates
    );

    if (result.ok) {
      setDocument(result.data);
      setIsEditMode(false);
    } else {
      setSaveError(getErrorMessage(result.error));
    }

    setSaving(false);
  }

  function handleFormChange(field: keyof typeof editForm, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  // Calculate prev/next document IDs
  const currentIndex = id ? documentIds.indexOf(id) : -1;
  const prevDocId = currentIndex > 0 ? documentIds[currentIndex - 1] : null;
  const nextDocId = currentIndex >= 0 && currentIndex < documentIds.length - 1 ? documentIds[currentIndex + 1] : null;

  // Use ref to avoid re-creating callbacks when documentIds changes by reference
  const documentIdsRef = React.useRef(documentIds);
  React.useEffect(() => {
    documentIdsRef.current = documentIds;
  }, [documentIds]);

  // Navigation helpers
  const navigateToPrev = React.useCallback(() => {
    if (prevDocId) {
      setNavigating('prev');
      navigate(`/documents/${prevDocId}`, { state: { documentIds: documentIdsRef.current } });
    }
  }, [prevDocId, navigate]);

  const navigateToNext = React.useCallback(() => {
    if (nextDocId) {
      setNavigating('next');
      navigate(`/documents/${nextDocId}`, { state: { documentIds: documentIdsRef.current } });
    }
  }, [nextDocId, navigate]);

  // Keyboard navigation (arrow keys)
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      // Ignore if user is interacting with input-like fields or editable areas
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateToPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateToNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateToPrev, navigateToNext]);

  // Swipe gesture support for mobile with real-time drag preview
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);
  const touchStartTarget = React.useRef<EventTarget | null>(null);
  const isDragging = React.useRef(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const SWIPE_THRESHOLD = 80; // Minimum distance for swipe detection
  const DRAG_RESISTANCE = 0.4; // Resistance when dragging beyond threshold

  const handleTouchStart = React.useCallback((event: React.TouchEvent) => {
    // Skip if touch started on interactive elements
    const target = event.target;
    if (target instanceof HTMLElement) {
      const interactiveElement = target.closest('button, a, input, textarea, select, iframe, [role="button"]');
      if (interactiveElement) {
        return;
      }
    }

    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    touchStartTarget.current = event.target;
    isDragging.current = false;
  }, []);

  const handleTouchMove = React.useCallback((event: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    const deltaX = touchX - touchStartX.current;
    const deltaY = touchY - touchStartY.current;

    // Determine if this is a horizontal drag (only on first significant movement)
    if (!isDragging.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > 10 || absY > 10) {
        // If more vertical than horizontal, don't track as drag
        if (absY > absX) {
          touchStartX.current = null;
          touchStartY.current = null;
          return;
        }
        isDragging.current = true;
      }
    }

    if (isDragging.current) {
      // Check if we can navigate in this direction
      const canGoLeft = deltaX > 0 && prevDocId;
      const canGoRight = deltaX < 0 && nextDocId;

      if (canGoLeft || canGoRight) {
        // Apply resistance for a natural feel
        const resistance = Math.abs(deltaX) > SWIPE_THRESHOLD ? DRAG_RESISTANCE : 1;
        const cappedDelta = deltaX * resistance;
        setDragOffset(Math.max(-150, Math.min(150, cappedDelta)));
      } else {
        // Can't navigate in this direction, show resistance
        setDragOffset(deltaX * 0.2);
      }
    }
  }, [prevDocId, nextDocId]);

  const handleTouchEnd = React.useCallback(() => {
    if (touchStartX.current === null) {
      setDragOffset(0);
      return;
    }

    const shouldNavigate = Math.abs(dragOffset) > SWIPE_THRESHOLD * 0.8;

    if (shouldNavigate && isDragging.current) {
      if (dragOffset > 0 && prevDocId) {
        navigateToPrev();
      } else if (dragOffset < 0 && nextDocId) {
        navigateToNext();
      }
    }

    // Reset
    setDragOffset(0);
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTarget.current = null;
    isDragging.current = false;
  }, [dragOffset, prevDocId, nextDocId, navigateToPrev, navigateToNext]);

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

  // Navigation overlay - rendered in all states
  const navigationOverlay = navigating && (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50">
        <div
          className="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 px-8 py-6 rounded-2xl shadow-2xl"
          style={{
            animation: `${navigating === 'prev' ? 'slideFromLeft' : 'slideFromRight'} 0.4s ease-out`,
          }}
        >
          <span
            className="text-5xl text-blue-600 dark:text-blue-400"
            aria-hidden="true"
            style={{
              animation: `${navigating === 'prev' ? 'bounceLeft' : 'bounceRight'} 0.6s ease-in-out infinite`,
            }}
          >
            {navigating === 'prev' ? '←' : '→'}
          </span>
          <span className="text-gray-700 dark:text-gray-200 font-semibold text-lg">
            {navigating === 'prev' ? 'Previous' : 'Next'}
          </span>
        </div>
      </div>
      <style>{`
        @keyframes slideFromLeft {
          from { opacity: 0; transform: translateX(-40px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideFromRight {
          from { opacity: 0; transform: translateX(40px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes bounceLeft {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-8px); }
        }
        @keyframes bounceRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
      `}</style>
    </>
  );

  if (loading) {
    return (
      <>
        {navigationOverlay}
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-gray-600 dark:text-gray-400">Loading document...</div>
        </div>
      </>
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

  // Drag direction indicator
  const dragDirection = dragOffset > 20 ? 'prev' : dragOffset < -20 ? 'next' : null;
  const dragIndicator = dragDirection && !navigating && (
    <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
      <div
        className="bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
        style={{
          opacity: Math.min(1, Math.abs(dragOffset) / 80),
          transform: `scale(${0.8 + Math.min(0.2, Math.abs(dragOffset) / 400)})`,
        }}
      >
        <span className="text-4xl text-blue-600 dark:text-blue-400">
          {dragDirection === 'prev' ? '←' : '→'}
        </span>
        <span className="text-gray-700 dark:text-gray-200 font-semibold">
          {dragDirection === 'prev' ? 'Previous' : 'Next'}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="space-y-6 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: dragOffset ? `translateX(${dragOffset}px)` : undefined,
        transition: dragOffset ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      {dragIndicator}
      {navigationOverlay}

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
              onClick={navigateToPrev}
              disabled={!prevDocId}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:disabled:hover:text-gray-400"
              title={prevDocId ? 'Previous document (←)' : 'No previous document'}
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
              onClick={navigateToNext}
              disabled={!nextDocId}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:disabled:hover:text-gray-400"
              title={nextDocId ? 'Next document (→)' : 'No next document'}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Details</h3>
              <button
                onClick={handleEditToggle}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isEditMode ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditMode ? (
              // Edit mode form
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="originalFilename"
                    className="block text-sm text-gray-500 dark:text-gray-400 mb-1"
                  >
                    File name
                  </label>
                  <input
                    id="originalFilename"
                    type="text"
                    value={editForm.originalFilename}
                    onChange={(e) => handleFormChange('originalFilename', e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="documentOwner"
                    className="block text-sm text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Document Owner
                  </label>
                  <OwnerNameAutocomplete
                    id="documentOwner"
                    value={editForm.documentOwner}
                    onChange={(value) => handleFormChange('documentOwner', value)}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div>
                  <label
                    htmlFor="documentType"
                    className="block text-sm text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Document Type
                  </label>
                  <input
                    id="documentType"
                    type="text"
                    value={editForm.documentType}
                    onChange={(e) => handleFormChange('documentType', e.target.value)}
                    placeholder="e.g., passport, invoice"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Category
                  </label>
                  <input
                    id="category"
                    type="text"
                    value={editForm.category}
                    onChange={(e) => handleFormChange('category', e.target.value)}
                    placeholder="e.g., identity, financial"
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {saveError && (
                  <div className="text-sm text-red-600 dark:text-red-400">{saveError}</div>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving || !editForm.originalFilename.trim()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              // View mode - definition list
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">File name</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{document.originalFilename}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{formatDate(document.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Document ID</dt>
                  <dd className="text-gray-900 dark:text-gray-100 text-xs break-all">{document.id}</dd>
                </div>
                {document.documentOwner && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Document Owner</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{document.documentOwner}</dd>
                  </div>
                )}
                {document.documentType && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Document Type</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{document.documentType}</dd>
                  </div>
                )}
                {document.category && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Category</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{document.category}</dd>
                  </div>
                )}
                {document.expiryDate && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Expiry Date</dt>
                    <dd className="text-gray-900 dark:text-gray-100">{document.expiryDate}</dd>
                  </div>
                )}
              </dl>
            )}
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
