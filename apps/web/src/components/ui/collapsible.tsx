import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

export function Collapsible({
  title,
  defaultOpen = false,
  children,
  className,
  badge,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('rounded-md border border-border', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-secondary/50"
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {badge}
        </div>
        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
        />
      </button>
      {isOpen && <div className="border-t border-border px-3 py-2">{children}</div>}
    </div>
  );
}
