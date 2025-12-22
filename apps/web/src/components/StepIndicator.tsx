export type StepStatus = 'pending' | 'active' | 'complete' | 'error' | 'skipped';

interface StepIndicatorProps {
  label: string;
  status: StepStatus;
  sublabel?: string;
}

export function StepIndicator({ label, status, sublabel }: StepIndicatorProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'active':
        return 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'complete':
        return 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'error':
        return 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'skipped':
        return 'border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500';
      default:
        return 'border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'active':
        return (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
        );
      case 'complete':
        return (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'skipped':
        return <span className="text-xs">-</span>;
      default:
        return <span className="h-2 w-2 rounded-full bg-current" />;
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${getStatusStyles()}`}
      >
        {getIcon()}
      </div>
      <span className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      {sublabel && <span className="text-xs text-gray-400 dark:text-gray-500">{sublabel}</span>}
    </div>
  );
}
