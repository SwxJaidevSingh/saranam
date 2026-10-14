import { LayoutGrid, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ViewSwitcher({ activeView, onViewChange, className }) {
  return (
    <div className={cn("inline-flex items-center p-1 bg-muted/60 backdrop-blur-sm rounded-lg border border-border/60 shadow-sm", className)}>
      <button
        onClick={() => onViewChange('graph')}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
          activeView === 'graph'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>Graph</span>
      </button>
      <button
        onClick={() => onViewChange('map')}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
          activeView === 'map'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
      >
        <Map className="h-3.5 w-3.5" />
        <span>Map</span>
      </button>
    </div>
  );
}
