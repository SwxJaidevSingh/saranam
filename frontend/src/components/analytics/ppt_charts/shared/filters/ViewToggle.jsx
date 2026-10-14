import React from 'react';
import { BarChart3, Table as TableIcon } from 'lucide-react';

export function ViewToggle({ view = 'chart', onChange }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange('chart')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
          view === 'chart'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Chart View"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        <span>Chart</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
          view === 'table'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Table View"
      >
        <TableIcon className="h-3.5 w-3.5" />
        <span>Table</span>
      </button>
    </div>
  );
}

export default ViewToggle;
