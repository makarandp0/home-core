import type { DocumentData } from '@ohs/types';

interface DocumentDataDisplayProps {
  document: DocumentData;
}

export function DocumentDataDisplay({ document }: DocumentDataDisplayProps) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <dt className="w-24 shrink-0 font-medium text-muted-foreground">Type</dt>
        <dd>{document.document_type}</dd>
      </div>
      {document.id && (
        <div className="flex items-start gap-2">
          <dt className="w-24 shrink-0 font-medium text-muted-foreground">ID</dt>
          <dd>{document.id}</dd>
        </div>
      )}
      {document.name && (
        <div className="flex items-start gap-2">
          <dt className="w-24 shrink-0 font-medium text-muted-foreground">Name</dt>
          <dd>{document.name}</dd>
        </div>
      )}
      {document.expiry_date && (
        <div className="flex items-start gap-2">
          <dt className="w-24 shrink-0 font-medium text-muted-foreground">Expiry</dt>
          <dd>{document.expiry_date}</dd>
        </div>
      )}
      {document.fields && Object.keys(document.fields).length > 0 && (
        <div className="border-t border-border pt-2">
          <dt className="mb-1 font-medium text-muted-foreground">Fields</dt>
          <dd>
            <dl className="space-y-1">
              {Object.entries(document.fields).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <dt className="w-24 shrink-0 text-muted-foreground">{key}</dt>
                  <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          </dd>
        </div>
      )}
    </dl>
  );
}
