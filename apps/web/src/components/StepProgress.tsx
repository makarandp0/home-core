import { StepIndicator, type StepStatus } from './StepIndicator';
import type { ExtractionMethod } from '@ohs/types';

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
    <div className="flex items-center gap-2">
      <StepIndicator
        label="Extract"
        status={statuses.extracting}
        sublabel={extractionMethod ? `(${extractionMethod})` : undefined}
      />
      <div className="h-0.5 w-6 bg-gray-300 dark:bg-gray-600" />
      <StepIndicator label="Parse" status={statuses.parsing} />
    </div>
  );
}
