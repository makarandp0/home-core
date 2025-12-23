import { StepIndicator, type StepStatus } from './StepIndicator';
import type { ExtractionMethod } from '@home/types';

export interface StepStatuses {
  extracting: StepStatus;
  parsing: StepStatus;
}

interface StepProgressProps {
  statuses: StepStatuses;
  extractionMethod: ExtractionMethod | null;
}

export function StepProgress({ statuses, extractionMethod }: StepProgressProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <StepIndicator
        label="1. Extract Text"
        status={statuses.extracting}
        sublabel={extractionMethod ? `(${extractionMethod})` : undefined}
      />
      <div className="h-0.5 flex-1 bg-gray-200 dark:bg-gray-700" />
      <StepIndicator label="2. Parse JSON" status={statuses.parsing} />
    </div>
  );
}
