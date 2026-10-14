import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, FileText } from 'lucide-react';

export const ReportTablePreview = ({
  rows = [],
  columns = [],
  allColumnMeta = [],
  totalCount = 0,
  loading = false
}) => {
  // Map column IDs to human-readable labels
  const labelMap = {};
  allColumnMeta.forEach((col) => {
    labelMap[col.id] = col.label;
  });

  return (
    <Card className="border border-border/80 shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-semibold text-foreground">
            Live Data Preview
          </CardTitle>
          <Badge variant="outline" className="text-xs font-normal">
            Showing first {rows.length} of {totalCount} records
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Showing {columns.length} chosen columns
        </span>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground">Updating data preview...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground">No records found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting the date range or filters above to see results.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/50 sticky top-0 border-b border-border z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-muted-foreground w-12 text-center">
                    #
                  </th>
                  {columns.map((colId) => (
                    <th
                      key={colId}
                      className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap"
                    >
                      {labelMap[colId] || colId.replace(/_/g, ' ').toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-accent/30 transition-colors odd:bg-background even:bg-muted/10"
                  >
                    <td className="py-2 px-3 text-muted-foreground text-center font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    {columns.map((colId) => {
                      const val = row[colId];
                      const isDist = colId.includes('distance');
                      return (
                        <td
                          key={colId}
                          className="py-2 px-3 whitespace-nowrap text-foreground font-normal"
                        >
                          {isDist && val !== 'N/A' && typeof val === 'number' ? (
                            <span className="font-semibold text-primary">{val} km</span>
                          ) : val === 'Active' || val === 'Yes' || val === 'Completed' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              {val}
                            </span>
                          ) : val === 'Deceased' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400">
                              {val}
                            </span>
                          ) : (
                            String(val ?? 'N/A')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportTablePreview;
