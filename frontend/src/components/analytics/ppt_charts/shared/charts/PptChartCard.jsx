import React, { useState } from 'react';
import { Download, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { exportChartAsSvg } from '@/utils/chartExport';
import { ViewToggle } from '../filters/ViewToggle';
import { StatusFilter } from '../filters/StatusFilter';
import { ComplexityFilter } from '../filters/ComplexityFilter';
import { DateRangeFilter } from '../filters/DateRangeFilter';

export function PptChartCard({
  id,
  title,
  description,
  children,
  isLoading = false,
  className,
  // View mode
  view = 'chart',
  onViewChange,
  // Filters
  dateRange,
  onDateRangeChange,
  status,
  onStatusChange,
  complexity,
  onComplexityChange,
  // Optional extra chart-specific controls
  extraFilters,
  hideFilters = false,
  hideViewToggle = false,
  hideDownload = false,
  // Calculation info
  infoContent,
  infoTitle,
}) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden shadow-sm border-border bg-card', className)}>
        <CardHeader className="pb-3 space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-6 w-48" />
            {description && <Skeleton className="h-4 w-72 mt-1" />}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[320px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/10 shadow-sm transition-all duration-300 hover:shadow-md', className)} id={id}>
      {/* Top subtle sheen line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 dark:via-white/25 to-transparent" />

      <CardHeader className="pb-3 space-y-3">
        {/* Row 1: Title & Description with full width */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {title}
            </CardTitle>
            {infoContent && (
              <button
                type="button"
                onClick={() => setIsInfoOpen(true)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-blue-100/70 hover:text-blue-600 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="View calculation formula & methodology"
                aria-label="View calculation formula and methodology"
                data-export-ignore="true"
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </div>
          {description && (
            <CardDescription className="text-xs text-muted-foreground font-normal leading-relaxed">
              {description}
            </CardDescription>
          )}
        </div>

        {/* Row 2: Action and Filter Controls Bar on its own row */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50"
          data-export-ignore="true"
        >
          {/* Left: Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {!hideFilters && (
              <>
                {onDateRangeChange && (
                  <DateRangeFilter dateRange={dateRange} onChange={onDateRangeChange} />
                )}
                {onStatusChange && (
                  <StatusFilter value={status} onChange={onStatusChange} />
                )}
                {onComplexityChange && (
                  <ComplexityFilter value={complexity} onChange={onComplexityChange} />
                )}
                {extraFilters}
              </>
            )}
          </div>

          {/* Right: View switcher & Download button */}
          <div className="flex items-center gap-2 ml-auto">
            {!hideViewToggle && onViewChange && (
              <ViewToggle view={view} onChange={onViewChange} />
            )}

            {!hideDownload && id && (
              <button
                type="button"
                onClick={() => exportChartAsSvg(id, `${(title || 'chart').toLowerCase().replace(/\s+/g, '-')}.png`)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background p-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title="Download Chart Image"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {children}
      </CardContent>

      {/* Calculation Formula & Info Modal */}
      {infoContent && (
        <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto sm:rounded-2xl border-border bg-card shadow-2xl p-6">
            <DialogHeader className="space-y-1.5 pb-2 border-b border-border/60">
              <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400 shrink-0">
                  <Info className="h-4 w-4" />
                </div>
                <span>{infoTitle || title}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detailed calculation methodology, mathematical formula, and clinical protocol rules.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3">
              {infoContent}
            </div>

            <DialogFooter className="pt-2 border-t border-border/60 sm:justify-end">
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

export default PptChartCard;
