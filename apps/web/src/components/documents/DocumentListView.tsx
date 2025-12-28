import * as React from 'react';
import type { DocumentMetadata } from '@home/types';

interface DocumentWithExpiry extends DocumentMetadata {
  _expiryStatus: string;
}

interface DocumentListViewProps {
  documents: DocumentWithExpiry[];
  thumbnails: Record<string, string | null>;
  onNavigate: (id: string) => void;
  formatDate: (dateString: string) => string;
  formatShortDate: (dateString: string | null) => string;
}

export function DocumentListView({
  documents,
  thumbnails,
  onNavigate,
  formatDate,
  formatShortDate,
}: DocumentListViewProps) {
  return (
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
              Dates
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const expiryStatus = doc._expiryStatus;
            const thumbnail = thumbnails[doc.id];
            const isPdf = doc.mimeType === 'application/pdf';
            return (
              <tr
                key={doc.id}
                onClick={() => onNavigate(doc.id)}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
