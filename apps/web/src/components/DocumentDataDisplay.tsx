import type { DocumentData } from '@home/types';

interface DocumentDataDisplayProps {
  document: DocumentData;
}

export function DocumentDataDisplay({ document }: DocumentDataDisplayProps) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Document Data</h4>
      <div className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <dl className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">Type</dt>
            <dd className="text-gray-900 dark:text-gray-100">{document.document_type}</dd>
          </div>
          {document.id && (
            <div className="flex items-start gap-2">
              <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">ID</dt>
              <dd className="text-gray-900 dark:text-gray-100">{document.id}</dd>
            </div>
          )}
          {document.name && (
            <div className="flex items-start gap-2">
              <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="text-gray-900 dark:text-gray-100">{document.name}</dd>
            </div>
          )}
          {document.expiry_date && (
            <div className="flex items-start gap-2">
              <dt className="w-24 shrink-0 font-medium text-gray-500 dark:text-gray-400">Expiry</dt>
              <dd className="text-gray-900 dark:text-gray-100">{document.expiry_date}</dd>
            </div>
          )}
          {document.fields && Object.keys(document.fields).length > 0 && (
            <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
              <dt className="mb-1 font-medium text-gray-500 dark:text-gray-400">Fields</dt>
              <dd>
                <dl className="space-y-1">
                  {Object.entries(document.fields).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2">
                      <dt className="w-24 shrink-0 text-gray-600 dark:text-gray-300">{key}</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{value}</dd>
                    </div>
                  ))}
                </dl>
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
