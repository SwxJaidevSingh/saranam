import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  SlidersHorizontal,
  MapPin,
  Building2,
  Check,
  Columns3
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ColumnSelector = ({
  columns = [],
  selectedColumns = [],
  onChangeColumns,
  defaultColumns = [],
  hospitals = [],
  customHospital,
  onCustomHospitalChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Map of column IDs to labels
  const labelMap = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      map[col.id] = col.label;
    });
    return map;
  }, [columns]);

  // Group columns by category
  const categories = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      const cat = col.category || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push(col);
    });
    return map;
  }, [columns]);

  // Filter columns by search query inside modal
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    const result = {};

    Object.entries(categories).forEach(([cat, cols]) => {
      const matching = cols.filter(
        (c) => c.label.toLowerCase().includes(query) || c.id.toLowerCase().includes(query)
      );
      if (matching.length > 0) {
        result[cat] = matching;
      }
    });
    return result;
  }, [categories, searchQuery]);

  const toggleColumn = (colId) => {
    if (selectedColumns.includes(colId)) {
      if (selectedColumns.length === 1) return; // Keep at least one column
      onChangeColumns(selectedColumns.filter((id) => id !== colId));
    } else {
      onChangeColumns([...selectedColumns, colId]);
    }
  };

  const selectAll = () => {
    onChangeColumns((columns || []).map((c) => c.id));
  };

  const clearAll = () => {
    if (columns && columns.length > 0) {
      onChangeColumns([columns[0].id]);
    } else {
      onChangeColumns([]);
    }
  };

  const resetToDefault = () => {
    if (defaultColumns && defaultColumns.length > 0) {
      onChangeColumns(defaultColumns);
    } else if (columns && columns.length > 0) {
      onChangeColumns(columns.slice(0, 8).map((c) => c.id));
    }
  };

  const handleHospitalDropdownChange = (val) => {
    const newHospital = val === 'none' ? null : val;
    onCustomHospitalChange(newHospital);

    let updated = [...selectedColumns];
    // If a previous custom hospital was selected, remove its column
    if (customHospital) {
      const prevColId = `distance_${customHospital.toLowerCase()}`;
      updated = updated.filter((c) => c !== prevColId);
    }
    // Add the newly selected hospital column
    if (newHospital) {
      const newColId = `distance_${newHospital.toLowerCase()}`;
      if (!updated.includes(newColId)) {
        updated.push(newColId);
      }
    }
    onChangeColumns(updated);
  };

  // Quick Preset Combinations
  const applyPreset = (presetType) => {
    if (presetType === 'demographics_geo') {
      const ids = ['uhid', 'full_name', 'age', 'gender', 'geographic_cluster', 'address', 'latitude', 'longitude', 'distance_kmio', 'distance_kcgh', 'care_status'];
      onChangeColumns(columns.filter((c) => ids.includes(c.id)).map((c) => c.id));
    } else if (presetType === 'clinical') {
      const ids = ['uhid', 'full_name', 'diagnosis', 'care_status', 'latest_pps_score', 'clinical_complexity', 'bsc_status', 'pain_score'];
      onChangeColumns(columns.filter((c) => ids.includes(c.id)).map((c) => c.id));
    } else if (presetType === 'hospital_proximity') {
      const ids = ['uhid', 'full_name', 'linked_hospital', 'distance_kmio', 'distance_kcgh', 'distance_linked', 'nearest_hospital', 'nearest_hospital_dist', 'address'];
      onChangeColumns(columns.filter((c) => ids.includes(c.id)).map((c) => c.id));
    } else if (presetType === 'contacts') {
      const ids = ['uhid', 'full_name', 'geographic_cluster', 'address', 'primary_caregiver_name', 'primary_caregiver_phone', 'care_status'];
      onChangeColumns(columns.filter((c) => ids.includes(c.id)).map((c) => c.id));
    }
  };

  return (
    <>
      {/* 1. Compact Clean Banner on the Page */}
      <Card className="border border-border/80 shadow-sm p-3.5 bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Columns3 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Columns to Include</span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                  {selectedColumns.length} of {columns.length} selected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-xl">
                {selectedColumns.map((id) => labelMap[id] || id).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick preset chips on main page */}
            <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground mr-1">
              <span className="text-[11px] mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('demographics_geo')}
                className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-xs"
              >
                Demographics & Distances
              </button>
              <button
                type="button"
                onClick={() => applyPreset('clinical')}
                className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-xs"
              >
                Clinical
              </button>
              <button
                type="button"
                onClick={() => applyPreset('hospital_proximity')}
                className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-xs"
              >
                Hospital Proximity
              </button>
            </div>

            {/* Modal Trigger Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(true)}
              className="gap-2 h-9 px-3.5 font-medium border-primary/30 hover:border-primary hover:bg-primary/5 text-primary"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Customize Columns
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Modal / Dialog for Detailed Column Selection */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <DialogTitle className="text-base font-semibold">
                  Select Columns to Include in Report
                </DialogTitle>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                  {selectedColumns.length} of {columns.length} selected
                </Badge>
              </div>

              {/* Quick Actions & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search columns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 pr-2.5 text-xs bg-background border border-input rounded-md w-44 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <Button variant="ghost" size="sm" onClick={selectAll} className="h-8 px-2 text-xs">
                  <CheckSquare className="w-3.5 h-3.5 mr-1" />
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-xs text-muted-foreground">
                  <Square className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
                <Button variant="ghost" size="sm" onClick={resetToDefault} className="h-8 px-2 text-xs text-muted-foreground">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Default
                </Button>
              </div>
            </div>

            {/* Quick Presets row */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2.5 text-xs text-muted-foreground">
              <span className="font-medium mr-1">Quick Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset('demographics_geo')}
                className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              >
                Demographics & Distances
              </button>
              <button
                type="button"
                onClick={() => applyPreset('clinical')}
                className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              >
                Clinical & Functional
              </button>
              <button
                type="button"
                onClick={() => applyPreset('hospital_proximity')}
                className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              >
                Hospital Proximity
              </button>
              <button
                type="button"
                onClick={() => applyPreset('contacts')}
                className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              >
                Caregiver Contacts
              </button>
            </div>
          </DialogHeader>

          {/* Modal Body: Scrollable Column Grid */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Custom Hospital Selector inside modal */}
            {hospitals.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    Calculate Distance to Additional Hospital:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={customHospital || 'none'}
                    onValueChange={handleHospitalDropdownChange}
                  >
                    <SelectTrigger className="w-[200px] h-8 text-xs bg-background">
                      <SelectValue placeholder="Select hospital..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">None (Kidwai & KCGH only)</SelectItem>
                      {hospitals
                        .filter((h) => !['KMIO', 'KCGH'].includes(h.code))
                        .map((h) => (
                          <SelectItem key={h.code} value={h.code} className="text-xs">
                            {h.name} ({h.short_name})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {customHospital && (
                    <Badge variant="outline" className="text-xs border-primary text-primary font-medium">
                      + Distance to {hospitals.find((h) => h.code === customHospital)?.short_name || customHospital} added
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Categorized Checkbox Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(filteredCategories).map(([category, cols]) => (
                <div
                  key={category}
                  className="p-3 rounded-lg border border-border/60 bg-card/60 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                    <span className="text-xs font-bold text-foreground tracking-wide uppercase">
                      {category}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {cols.filter((c) => selectedColumns.includes(c.id)).length}/{cols.length}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {cols.map((col) => {
                      const isChecked = selectedColumns.includes(col.id);
                      const isGeo = col.id.includes('distance') || col.id.includes('hospital');
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer select-none text-xs transition-colors ${
                            isChecked
                              ? 'bg-primary/10 text-foreground font-medium'
                              : 'hover:bg-accent/40 text-muted-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5"
                          />
                          <span className="truncate flex-1 flex items-center gap-1">
                            {isGeo && <MapPin className="w-3 h-3 text-primary shrink-0" />}
                            {col.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <DialogFooter className="p-3 px-4 border-t border-border/60 bg-muted/10 flex flex-row items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedColumns.length} columns will appear in preview & export
            </span>
            <Button
              onClick={() => setIsOpen(false)}
              className="h-8 px-4 text-xs font-semibold gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ColumnSelector;
