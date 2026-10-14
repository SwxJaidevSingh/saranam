import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format, subMonths, startOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PRESET_OPTIONS = [
  { label: 'All Time', value: 'all', getRange: () => null },
  { label: 'Last 1 Month', value: '1m', getRange: () => ({ from: subMonths(new Date(), 1), to: new Date() }) },
  { label: 'Last 3 Months', value: '3m', getRange: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: 'Last 6 Months', value: '6m', getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: 'Last 1 Year', value: '1y', getRange: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
  { label: 'Year To Date', value: 'ytd', getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export function DateRangeFilter({
  dateRange,
  onChange,
  className = '',
  initialPreset = '1m',
}) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState(() => (dateRange ? initialPreset : 'all'));

  useEffect(() => {
    if (!dateRange) {
      setActivePreset('all');
    }
  }, [dateRange]);


  const handlePresetSelect = (presetVal) => {
    setActivePreset(presetVal);
    const preset = PRESET_OPTIONS.find((p) => p.value === presetVal);
    if (preset && onChange) {
      onChange(preset.getRange());
    }
  };

  const handleCalendarSelect = (range) => {
    setActivePreset('custom');
    if (onChange) {
      onChange(range);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setActivePreset('all');
    if (onChange) onChange(null);
  };

  const formatButtonText = () => {
    if (!dateRange?.from) return 'All Dates';
    if (!dateRange?.to) return format(dateRange.from, 'MMM d, yyyy');
    return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Preset Dropdown */}
      <Select value={activePreset} onValueChange={handlePresetSelect}>
        <SelectTrigger className="h-8 w-[110px] rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground shadow-sm">
          <SelectValue placeholder="Preset" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
          {activePreset === 'custom' && (
            <SelectItem value="custom" className="text-xs">
              Custom Range
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* Custom Calendar Picker Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-md px-2.5 text-xs font-normal shadow-sm"
            title="Custom Date Range"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={!dateRange?.from ? 'text-muted-foreground' : 'text-foreground font-medium'}>
              {formatButtonText()}
            </span>
            {dateRange?.from && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="ml-1 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Clear date filter"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from || new Date()}
            selected={dateRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={(date) => date > new Date() || date < new Date('2020-01-01')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateRangeFilter;
