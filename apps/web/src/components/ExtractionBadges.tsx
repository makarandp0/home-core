import type { ExtractionMethod } from '@home/types';

// Confidence threshold for LLM re-extraction (80%)
export const CONFIDENCE_THRESHOLD = 0.8;

interface ExtractionBadgesProps {
  method: ExtractionMethod | null;
  confidence: number | null;
  usedLLMExtraction: boolean;
}

export function ExtractionBadges({ method, confidence, usedLLMExtraction }: ExtractionBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {method && (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          Extraction: {method}
        </span>
      )}
      {confidence !== null && (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            confidence >= CONFIDENCE_THRESHOLD
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
          }`}
        >
          Confidence: {(confidence * 100).toFixed(1)}%
        </span>
      )}
      {usedLLMExtraction && (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
          LLM Re-extracted
        </span>
      )}
    </div>
  );
}
