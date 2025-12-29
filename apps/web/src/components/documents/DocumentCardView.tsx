import * as React from 'react';
import type { DocumentMetadata } from '@home/types';

interface DocumentWithExpiry extends DocumentMetadata {
  _expiryStatus: string;
}

export type CardStyle = 'compact' | 'minimal';

interface DocumentCardViewProps {
  documents: DocumentWithExpiry[];
  thumbnails: Record<string, string | null>;
  onNavigate: (id: string) => void;
  formatShortDate: (dateString: string | null) => string;
  cardStyle?: CardStyle;
}

export function DocumentCardView({
  documents,
  thumbnails,
  onNavigate,
  formatShortDate,
  cardStyle = 'minimal',
}: DocumentCardViewProps) {
  // Grid configuration based on card style
  const gridClass = cardStyle === 'minimal'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3';

  return (
    <div className={gridClass}>
      {documents.map((doc) => {
        const expiryStatus = doc._expiryStatus;
        const thumbnail = thumbnails[doc.id];
        const isPdf = doc.mimeType === 'application/pdf';

        const handleKeyDown = (event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onNavigate(doc.id);
          }
        };

        // Minimal style - horizontal card with small thumbnail
        if (cardStyle === 'minimal') {
          return (
            <div
              key={doc.id}
              onClick={() => onNavigate(doc.id)}
              onKeyDown={handleKeyDown}
              role="button"
              tabIndex={0}
              className="group flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {/* Small Thumbnail */}
              <div className="flex-shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                {thumbnail ? (
                  <img src={thumbnail} alt={doc.originalFilename} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isPdf ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    )}
                  </svg>
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm" title={doc.originalFilename}>
                    {doc.originalFilename}
                  </h3>
                  {expiryStatus !== 'valid' && expiryStatus !== 'none' && (
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${expiryStatus === 'expired' ? 'bg-red-500' : 'bg-amber-500'}`} title={expiryStatus === 'expired' ? 'Expired' : 'Expiring soon'} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {doc.documentOwner && <span className="truncate">{doc.documentOwner}</span>}
                  {doc.documentOwner && doc.documentType && <span>·</span>}
                  {doc.documentType && <span className="truncate">{doc.documentType}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span className="text-gray-400 dark:text-gray-500">
                    {formatShortDate(doc.createdAt)}
                  </span>
                  {doc.expiryDate && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className={
                        expiryStatus === 'expired'
                          ? 'text-red-600 dark:text-red-400'
                          : expiryStatus === 'expiring-soon'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-400 dark:text-gray-500'
                      }>
                        Exp: {formatShortDate(doc.expiryDate)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // Compact style - smaller thumbnail area, square aspect
        return (
          <div
            key={doc.id}
            onClick={() => onNavigate(doc.id)}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="group bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* Smaller Square Thumbnail */}
            <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
              {thumbnail ? (
                <img src={thumbnail} alt={doc.originalFilename} className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800" />
              ) : (
                <svg className="w-10 h-10 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isPdf ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  )}
                </svg>
              )}
              {/* Expiry indicator */}
              {expiryStatus !== 'valid' && expiryStatus !== 'none' && (
                <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${expiryStatus === 'expired' ? 'bg-red-500' : 'bg-amber-500'}`} title={expiryStatus === 'expired' ? 'Expired' : 'Expiring soon'} />
              )}
            </div>
            {/* Compact Content */}
            <div className="p-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm" title={doc.originalFilename}>
                {doc.originalFilename}
              </h3>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {doc.documentType || doc.documentOwner || formatShortDate(doc.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
