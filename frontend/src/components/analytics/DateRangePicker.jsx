import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays, subMonths, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const presetRanges = [
  { label: 'Last 7 days', value: 'last7days', getDates: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Last 30 days', value: 'last30days', getDates: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Last 3 months', value: 'last3months', getDates: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { label: 'Last 6 months', value: 'last6months', getDates: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: 'Last 12 months', value: 'last12months', getDates: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
  { label: 'Year to date', value: 'ytd', getDates: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export function DateRangePicker({ dateRange, onDateRangeChange, className }) {
  const [open, setOpen] = useState(false);

  const handlePresetSelect = (value) => {
    const preset = presetRanges.find(p => p.value === value);
    if (preset) {
      const dates = preset.getDates();
      onDateRangeChange(dates);
    }
  };

  const formatDateRange = () => {
    if (!dateRange?.from) return 'Select date range';
    if (!dateRange?.to) return format(dateRange.from, 'PPP');
    return `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Select onValueChange={handlePresetSelect}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Quick select" />
        </SelectTrigger>
        <SelectContent>
          {presetRanges.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
