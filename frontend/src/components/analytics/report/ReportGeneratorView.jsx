import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import { reportApi } from '@/api/reportApi';
import { DatasetAndFilterBar } from './DatasetAndFilterBar';
import { ColumnSelector } from './ColumnSelector';
import { ReportDataVisualizer } from './ReportDataVisualizer';
import { ReportTablePreview } from './ReportTablePreview';
import { ExportActionButtons } from './ExportActionButtons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Helper to format Date objects into local YYYY-MM-DD without UTC day shifts
const toDateString = (d) => {
  if (!d) return null;
  try {
    return format(new Date(d), 'yyyy-MM-dd');
  } catch {
    return null;
  }
};

export const ReportGeneratorView = () => {
  // Schema states
  const [schemaData, setSchemaData] = useState({ datasets: [], hospitals: [] });
  const [selectedDataset, setSelectedDataset] = useState('patients');
  const [isLoadingSchema, setIsLoadingSchema] = useState(true);
  const [schemaError, setSchemaError] = useState(null);

  // Filter states: Default timeline to last 30 days (1 month)
  const [activePreset, setActivePreset] = useState('30');
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [dateField, setDateField] = useState('registration_date');
  const [filters, setFilters] = useState({
    care_status: 'all',
    cluster: 'all',
    linked_hospital: 'all',
  });
  const [customHospital, setCustomHospital] = useState(null);

  // Column states
  const [selectedColumns, setSelectedColumns] = useState([]);

  // Data Preview states
  const [previewData, setPreviewData] = useState({
    total_count: 0,
    columns: [],
    preview_rows: [],
    visualization: {},
  });
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);

  // 1. Load initial schema on mount
  useEffect(() => {
    loadSchema();
  }, []);

  const loadSchema = async () => {
    setIsLoadingSchema(true);
    setSchemaError(null);
    try {
      const data = await reportApi.getDatasets();
      setSchemaData(data || { datasets: [], hospitals: [] });

      // Initialize columns for default dataset ('patients')
      const defaultDs = (data?.datasets || []).find((d) => d.id === 'patients') || data?.datasets?.[0];
      if (defaultDs) {
        setSelectedDataset(defaultDs.id);
        setDateField(defaultDs.default_date_field || defaultDs.date_fields?.[0]?.id || 'registration_date');
        const cols = defaultDs.columns || [];
        const defaultColIds = cols.filter((c) => c.default).map((c) => c.id);
        setSelectedColumns(defaultColIds.length > 0 ? defaultColIds : cols.slice(0, 8).map((c) => c.id));
      }
    } catch (err) {
      console.error('Failed to load report datasets schema:', err);
      setSchemaError('Unable to connect to the reporting service. Please check your connection.');
    } finally {
      setIsLoadingSchema(false);
    }
  };

  // Current active dataset schema object
  const currentDatasetSchema = useMemo(() => {
    return (schemaData.datasets || []).find((d) => d.id === selectedDataset) || null;
  }, [schemaData, selectedDataset]);

  // Handle Preset Date Selection
  const handlePresetDate = (preset) => {
    const pStr = String(preset);
    setActivePreset(pStr);
    if (pStr === 'all') {
      setDateRange({ from: null, to: null });
    } else if (pStr === 'ytd') {
      setDateRange({ from: startOfYear(new Date()), to: new Date() });
    } else {
      setDateRange({ from: subDays(new Date(), Number(preset)), to: new Date() });
    }
  };

  // Handle Custom Calendar Date Selection
  const handleCustomDateChange = (range) => {
    setActivePreset(null);
    setDateRange(range || { from: null, to: null });
  };

  // Handle dataset switch — fully resets timeline, filters, and columns to the new dataset's defaults
  const handleSelectDataset = (datasetId) => {
    if (datasetId === selectedDataset) return;
    setSelectedDataset(datasetId);

    const ds = (schemaData.datasets || []).find((d) => d.id === datasetId);
    if (ds) {
      setDateField(ds.default_date_field || ds.date_fields?.[0]?.id || 'registration_date');
      const cols = ds.columns || [];
      const defaultColIds = cols.filter((c) => c.default).map((c) => c.id);
      setSelectedColumns(defaultColIds.length > 0 ? defaultColIds : cols.slice(0, 8).map((c) => c.id));
      setCustomHospital(null);

      // Reset secondary filters to default
      setFilters({
        care_status: 'all',
        cluster: 'all',
        linked_hospital: 'all',
      });

      // Always reset timeline to default 30 days on dataset switch
      setActivePreset('30');
      setDateRange({
        from: subDays(new Date(), 30),
        to: new Date(),
      });
    }
  };

  // Handle single filter key change
  const handleFilterChange = (key, val) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  // 2. Fetch preview data when parameters change
  const fetchPreview = useCallback(async () => {
    if (!selectedDataset) return;
    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const payload = {
        dataset: selectedDataset,
        date_field: dateField,
        start_date: toDateString(dateRange?.from),
        end_date: toDateString(dateRange?.to),
        filters,
        columns: selectedColumns,
        custom_hospital_code: customHospital,
      };

      const result = await reportApi.getPreview(payload);
      setPreviewData(result || { total_count: 0, columns: [], preview_rows: [], visualization: {} });
    } catch (err) {
      console.error('Failed to fetch report preview:', err);
      const serverMsg = err.response?.data?.error;
      setPreviewError(serverMsg ? `Server Error: ${serverMsg}` : 'Failed to generate report preview. Please adjust filters or try again.');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [selectedDataset, dateField, dateRange, filters, selectedColumns, customHospital]);

  // Debounced/responsive preview trigger
  useEffect(() => {
    if (!isLoadingSchema && selectedColumns.length > 0) {
      const timer = setTimeout(() => {
        fetchPreview();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [fetchPreview, isLoadingSchema, selectedColumns]);

  // 3. Handle file download
  const handleExport = async (formatType) => {
    setIsExporting(true);
    setExportingFormat(formatType);
    try {
      const payload = {
        dataset: selectedDataset,
        date_field: dateField,
        start_date: toDateString(dateRange?.from),
        end_date: toDateString(dateRange?.to),
        filters,
        columns: selectedColumns,
        custom_hospital_code: customHospital,
      };

      await reportApi.downloadReport(payload, formatType);
    } catch (err) {
      console.error(`Export to ${formatType} failed:`, err);
      alert(`Export to ${formatType.toUpperCase()} failed. Please try again.`);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  if (schemaError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{schemaError}</span>
            <Button variant="outline" size="sm" onClick={loadSchema} className="ml-4 gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const allColumns = currentDatasetSchema?.columns || [];
  const defaultCols = allColumns.filter((c) => c.default).map((c) => c.id);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Custom Data Report & Export
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure datasets, select specific columns (including hospital distances), review live visualizations, and download cleanly in CSV or Excel.
          </p>
        </div>
      </div>

      {/* Step 1: Dataset & Time Range Filter Bar */}
      <DatasetAndFilterBar
        datasets={schemaData.datasets}
        selectedDataset={selectedDataset}
        onSelectDataset={handleSelectDataset}
        activePreset={activePreset}
        onPresetChange={handlePresetDate}
        dateRange={dateRange}
        onDateRangeChange={handleCustomDateChange}
        dateField={dateField}
        onDateFieldChange={setDateField}
        dateFieldOptions={currentDatasetSchema?.date_fields || []}
        filters={filters}
        onFilterChange={handleFilterChange}
        hospitals={schemaData.hospitals}
      />

      {/* Step 2: Column Selector */}
      <ColumnSelector
        columns={allColumns}
        selectedColumns={selectedColumns}
        onChangeColumns={setSelectedColumns}
        defaultColumns={defaultCols}
        hospitals={schemaData.hospitals}
        customHospital={customHospital}
        onCustomHospitalChange={setCustomHospital}
      />

      {/* Preview Error Alert if any */}
      {previewError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      )}

      {/* Step 3: Brief UI Visualizations */}
      <ReportDataVisualizer
        totalCount={previewData.total_count}
        selectedColumnsCount={selectedColumns.length}
        visualization={previewData.visualization}
        datasetName={currentDatasetSchema?.name}
      />

      {/* Step 4: Live Data Preview Table */}
      <ReportTablePreview
        rows={previewData.preview_rows}
        columns={selectedColumns}
        allColumnMeta={allColumns}
        totalCount={previewData.total_count}
        loading={isLoadingPreview}
      />

      {/* Step 5: Export Buttons Toolbar */}
      <ExportActionButtons
        onExport={handleExport}
        isExporting={isExporting}
        exportingFormat={exportingFormat}
        totalCount={previewData.total_count}
        selectedColumnsCount={selectedColumns.length}
      />
    </div>
  );
};

export default ReportGeneratorView;
