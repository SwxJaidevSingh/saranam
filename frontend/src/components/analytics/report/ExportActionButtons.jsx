import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Loader2, CheckCircle2 } from 'lucide-react';

export const ExportActionButtons = ({
  onExport,
  isExporting = false,
  exportingFormat = null,
  totalCount = 0,
  selectedColumnsCount = 0
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border/80 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>
          Ready to export <strong className="text-foreground">{totalCount}</strong> records with{' '}
          <strong className="text-foreground">{selectedColumnsCount}</strong> columns
        </span>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        {/* Download as CSV */}
        <Button
          variant="outline"
          onClick={() => onExport('csv')}
          disabled={isExporting || totalCount === 0}
          className="h-10 px-4 gap-2 text-xs font-semibold border-border hover:bg-secondary transition-all w-full sm:w-auto"
        >
          {isExporting && exportingFormat === 'csv' ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          )}
          Download as CSV
        </Button>

        {/* Download as XLSX */}
        <Button
          onClick={() => onExport('xlsx')}
          disabled={isExporting || totalCount === 0}
          className="h-10 px-4 gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all w-full sm:w-auto"
        >
          {isExporting && exportingFormat === 'xlsx' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          Download as XLSX
        </Button>
      </div>
    </div>
  );
};

export default ExportActionButtons;
