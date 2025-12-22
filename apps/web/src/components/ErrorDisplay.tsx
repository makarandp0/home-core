import * as React from 'react';
import { type ApiError, normalizeApiError } from '@home/types';

interface ErrorDisplayProps {
  error: ApiError | null | undefined;
  className?: string;
}

export function ErrorDisplay({ error, className = '' }: ErrorDisplayProps) {
  const [expanded, setExpanded] = React.useState(false);

  const normalized = normalizeApiError(error ?? undefined);

  if (!normalized) {
    return null;
  }

  const hasDetails = Boolean(normalized.details);

  return (
    <div
      className={`rounded-md bg-red-50 p-4 dark:bg-red-900/20 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <svg
            className="h-5 w-5 text-red-400 dark:text-red-300"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {normalized.message}
          </p>

          {hasDetails && (
            <>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
              >
                {expanded ? 'Hide details' : 'Show details'}
                <svg
                  className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expanded && (
                <div className="mt-2 rounded bg-red-100 p-2 dark:bg-red-900/30">
                  <pre className="whitespace-pre-wrap break-words text-xs text-red-700 dark:text-red-300 font-mono">
                    {normalized.details}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
