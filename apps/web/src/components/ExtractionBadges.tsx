import type { ExtractionMethod } from '@ohs/types';

interface ExtractionBadgesProps {
  method: ExtractionMethod | null;
  confidence?: number | null;
}

export function ExtractionBadges({ method, confidence }: ExtractionBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {method && (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Extraction: {method}
        </span>
      )}
      {confidence !== null && confidence !== undefined && (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Confidence: {(confidence * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
