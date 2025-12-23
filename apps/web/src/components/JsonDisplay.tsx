import * as React from 'react';
import { Check, Copy } from 'lucide-react';

interface JsonDisplayProps {
  data: string;
  title?: string;
}

export function JsonDisplay({ data, title = 'JSON Response' }: JsonDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  const formattedJson = React.useMemo(() => {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  }, [data]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-3 py-1.5">
        <span className="text-xs font-medium">{title}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="max-h-48 overflow-auto p-3 text-xs">
        <code className="text-foreground">{formattedJson}</code>
      </pre>
    </div>
  );
}
