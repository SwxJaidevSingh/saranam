import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Users, Car, Activity, Pill, HeartHandshake, Calendar as CalendarIcon, Filter } from 'lucide-react';

const DATASET_ICONS = {
  patients: Users,
  visits: Car,
  vitals: Activity,
  prescriptions: Pill,
  bereavement: HeartHandshake,
};

export const DatasetAndFilterBar = ({
  datasets = [],
  selectedDataset,
  onSelectDataset,
  activePreset = '30',
  onPresetChange,
  dateRange,
  onDateRangeChange,
  dateField,
  onDateFieldChange,
  dateFieldOptions = [],
  filters,
  onFilterChange,
  hospitals = []
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const formatDateDisplay = () => {
    if (activePreset === 'all' || (!dateRange?.from && !dateRange?.to)) {
      return 'All Time (No date filter)';
    }
    if (!dateRange?.from) return 'Select date range';
    if (!dateRange?.to) return format(dateRange.from, 'MMM d, yyyy');
    return `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
  };

  return (
    <div className="space-y-4">
      {/* 1. Dataset Selection Cards */}
      <div>
        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2.5">
          <Filter className="w-4 h-4 text-primary" />
          Select Report Dataset
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {datasets.map((ds) => {
            const Icon = DATASET_ICONS[ds.id] || Users;
            const isSelected = selectedDataset === ds.id;
            return (
              <button
                key={ds.id}
                type="button"
                onClick={() => onSelectDataset(ds.id)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
                    : 'border-border bg-card hover:bg-accent/40 hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-sm text-foreground line-clamp-1">
                    {ds.name.split(' ')[0]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {ds.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Time Range & Filter Controls */}
      <Card className="border border-border/80 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Date Field Target */}
            {dateFieldOptions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Filter by Date:</span>
                <Select value={dateField} onValueChange={onDateFieldChange}>
                  <SelectTrigger className="w-[180px] h-9 text-xs">
                    <SelectValue placeholder="Date field" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFieldOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">Presets:</span>
              <Button
                type="button"
                variant={activePreset === '7' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs font-medium"
                onClick={() => onPresetChange('7')}
              >
                7D
              </Button>
              <Button
                type="button"
                variant={activePreset === '30' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs font-medium"
                onClick={() => onPresetChange('30')}
              >
                30D
              </Button>
              <Button
                type="button"
                variant={activePreset === '90' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs font-medium"
                onClick={() => onPresetChange('90')}
              >
                90D
              </Button>
              <Button
                type="button"
                variant={activePreset === 'ytd' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs font-medium"
                onClick={() => onPresetChange('ytd')}
              >
                YTD
              </Button>
              <Button
                type="button"
                variant={activePreset === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-2.5 text-xs font-medium"
                onClick={() => onPresetChange('all')}
              >
                All Time
              </Button>
            </div>

            {/* Unified Calendar Popover */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 justify-start text-left font-normal text-xs min-w-[210px]",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateDisplay()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from || new Date()}
                  selected={dateRange}
                  onSelect={(range) => {
                    onDateRangeChange(range);
                    if (range?.from && range?.to) {
                      setCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Dataset-specific secondary filters */}
          {selectedDataset === 'patients' && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60">
              <span className="text-xs font-medium text-muted-foreground">Filters:</span>

              {/* Care Status */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select
                  value={filters.care_status || 'all'}
                  onValueChange={(val) => onFilterChange('care_status', val)}
                >
                  <SelectTrigger className="w-[125px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="active" className="text-xs">Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                    <SelectItem value="deceased" className="text-xs">Deceased</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Zone / Cluster */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Zone:</span>
                <Select
                  value={filters.cluster || 'all'}
                  onValueChange={(val) => onFilterChange('cluster', val)}
                >
                  <SelectTrigger className="w-[125px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Zones</SelectItem>
                    <SelectItem value="North" className="text-xs">North</SelectItem>
                    <SelectItem value="South" className="text-xs">South</SelectItem>
                    <SelectItem value="East" className="text-xs">East</SelectItem>
                    <SelectItem value="West" className="text-xs">West</SelectItem>
                    <SelectItem value="Central" className="text-xs">Central</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Linked Hospital */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Linked Hospital:</span>
                <Select
                  value={filters.linked_hospital || 'all'}
                  onValueChange={(val) => onFilterChange('linked_hospital', val)}
                >
                  <SelectTrigger className="w-[145px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Hospitals</SelectItem>
                    {hospitals.map((h) => (
                      <SelectItem key={h.code} value={h.code} className="text-xs">
                        {h.short_name || h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DatasetAndFilterBar;
