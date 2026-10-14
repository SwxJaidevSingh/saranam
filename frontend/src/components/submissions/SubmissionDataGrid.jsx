import { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

/**
 * Advanced Data Grid for Form Submissions
 * Features: sorting, filtering, pagination, column visibility, bulk actions
 */
export default function SubmissionDataGrid({
  submissions = [],
  formSchema = null,
  onExport,
  onBulkDelete,
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [visibleColumns, setVisibleColumns] = useState(new Set());
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Extract all possible columns from form schema
  const allColumns = useMemo(() => {
    if (!formSchema) return [];

    const fields = formSchema.fields || (formSchema.pages || []).flatMap(page => page.fields || []);

    return [
      { id: 'id', label: 'ID', type: 'text', sortable: true },
      { id: 'submitted_by', label: 'Submitted By', type: 'text', sortable: true },
      { id: 'created_at', label: 'Submission Date', type: 'date', sortable: true },
      ...fields
        .filter(field => field.type !== 'section') // Exclude section headers
        .map(field => ({
          id: field.id,
          label: field.label,
          type: field.type,
          sortable: true,
        })),
      { id: 'status', label: 'Status', type: 'text', sortable: true },
      { id: 'actions', label: 'Actions', type: 'actions', sortable: false },
    ];
  }, [formSchema]);

  // Initialize visible columns
  useMemo(() => {
    if (allColumns.length > 0 && visibleColumns.size === 0) {
      const defaultVisible = new Set(allColumns.slice(0, 6).map(col => col.id));
      defaultVisible.add('actions');
      setVisibleColumns(defaultVisible);
    }
  }, [allColumns]);

  // Get value from submission data
  const getCellValue = (submission, columnId) => {
    if (columnId === 'id') return submission.id;
    if (columnId === 'submitted_by') return submission.submitted_by_name;
    if (columnId === 'created_at') return submission.created_at;
    if (columnId === 'status') return submission.status;

    // Get value from submission data
    return submission.data?.[columnId];
  };

  // Format cell value based on type
  const formatCellValue = (value, type) => {
    if (value === null || value === undefined || value === '') return '-';

    switch (type) {
      case 'date':
        return format(new Date(value), 'MMM dd, yyyy');
      case 'time':
        return format(new Date(value), 'HH:mm');
      case 'checkbox':
        return value ? '✓' : '✗';
      case 'file':
        return value?.name || 'File uploaded';
      case 'linearScale':
        return `${value} / 5`;
      case 'select':
      case 'radio':
      case 'text':
      case 'email':
      case 'number':
      case 'textarea':
      case 'url':
      case 'phone':
      default:
        return String(value);
    }
  };

  // Sorting
  const sortedSubmissions = useMemo(() => {
    if (!sortConfig.key) return submissions;

    return [...submissions].sort((a, b) => {
      const aValue = getCellValue(a, sortConfig.key);
      const bValue = getCellValue(b, sortConfig.key);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [submissions, sortConfig]);

  // Pagination
  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedSubmissions.slice(startIndex, startIndex + pageSize);
  }, [sortedSubmissions, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedSubmissions.length / pageSize);

  // Handlers
  const handleSort = (columnId) => {
    setSortConfig(prev => ({
      key: columnId,
      direction: prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSelectAll = () => {
    if (selectedRows.size === paginatedSubmissions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedSubmissions.map(s => s.id)));
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleColumnVisibility = (columnId) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(columnId)) {
      newVisible.delete(columnId);
    } else {
      newVisible.add(columnId);
    }
    setVisibleColumns(newVisible);
  };

  const handleExportSelected = () => {
    const selected = submissions.filter(s => selectedRows.has(s.id));
    onExport?.(selected);
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedRows.size} selected submissions?`)) {
      onBulkDelete?.(Array.from(selectedRows));
      setSelectedRows(new Set());
    }
  };

  const visibleColumnsList = allColumns.filter(col => visibleColumns.has(col.id));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedRows.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedRows.size} selected
              </span>
              <button
                onClick={handleExportSelected}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Selected
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn-danger text-sm"
              >
                Delete Selected
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="input text-sm"
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>

          {/* Column Settings */}
          <div className="relative">
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="btn-secondary flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Columns
            </button>

            {showColumnSettings && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-lg shadow-lg border border-border p-4 z-10">
                <h4 className="font-semibold text-foreground mb-3">Visible Columns</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {allColumns.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-secondary p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.id)}
                        onChange={() => toggleColumnVisibility(col.id)}
                        className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-muted-foreground">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">
                  <button
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-secondary rounded"
                  >
                    {selectedRows.size === paginatedSubmissions.length && paginatedSubmissions.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground/70" />
                    )}
                  </button>
                </th>
                {visibleColumnsList.map((col) => (
                  <th key={col.id}>
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.id)}
                        className="flex items-center gap-2 font-semibold hover:text-primary-600 transition-colors"
                      >
                        {col.label}
                        {sortConfig.key === col.id ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp className="w-4 h-4" />
                          ) : (
                            <ArrowDown className="w-4 h-4" />
                          )
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-muted-foreground/70" />
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnsList.length + 1} className="text-center py-12 text-muted-foreground">
                    No submissions to display
                  </td>
                </tr>
              ) : (
                paginatedSubmissions.map((submission) => (
                  <tr key={submission.id} className={selectedRows.has(submission.id) ? 'bg-primary-50' : ''}>
                    <td>
                      <button
                        onClick={() => handleSelectRow(submission.id)}
                        className="p-1 hover:bg-secondary rounded"
                      >
                        {selectedRows.has(submission.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground/70" />
                        )}
                      </button>
                    </td>
                    {visibleColumnsList.map((col) => (
                      <td key={col.id}>
                        {col.id === 'actions' ? (
                          <Link
                            to={`/submissions/${submission.id}`}
                            className="btn-ghost inline-flex items-center gap-2 text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                        ) : col.id === 'status' ? (
                          <span className="badge-success">{submission.status}</span>
                        ) : (
                          formatCellValue(getCellValue(submission, col.id), col.type)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedSubmissions.length)} of{' '}
            {sortedSubmissions.length} submissions
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'bg-card text-foreground hover:bg-secondary'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
