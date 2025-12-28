import * as React from 'react';
import type { DocumentMetadata } from '@home/types';

interface DocumentWithExpiry extends DocumentMetadata {
  _expiryStatus: string;
}

interface DocumentCardViewProps {
  documents: DocumentWithExpiry[];
  thumbnails: Record<string, string | null>;
  onNavigate: (id: string) => void;
  formatShortDate: (dateString: string | null) => string;
}

export function DocumentCardView({
  documents,
  thumbnails,
  onNavigate,
  formatShortDate,
}: DocumentCardViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((doc) => {
        const expiryStatus = doc._expiryStatus;
        const thumbnail = thumbnails[doc.id];
        const isPdf = doc.mimeType === 'application/pdf';
        return (
          <div
            key={doc.id}
            onClick={() => onNavigate(doc.id)}
            className="group bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all"
          >
            {/* Thumbnail Area */}
            <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <svg
                  className="w-16 h-16 text-gray-300 dark:text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isPdf ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  )}
                </svg>
              )}
              {/* Expiry Badge */}
              {doc.expiryDate && expiryStatus !== 'valid' && expiryStatus !== 'none' && (
                <div
                  className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded ${
                    expiryStatus === 'expired'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                  }`}
                >
                  {expiryStatus === 'expired' ? 'Expired' : 'Expiring soon'}
                </div>
              )}
              {/* Type Badge */}
              {doc.documentType && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 text-xs font-medium rounded bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300">
                  {doc.documentType}
                </div>
              )}
            </div>

            {/* Card Content */}
            <div className="p-3">
              {/* Filename */}
              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate" title={doc.originalFilename}>
                {doc.originalFilename}
              </h3>

              {/* Owner */}
              {doc.documentOwner && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {doc.documentOwner}
                </p>
              )}

              {/* Metadata Row */}
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatShortDate(doc.createdAt)}</span>
                {doc.category && (
                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded truncate max-w-[50%]">
                    {doc.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
