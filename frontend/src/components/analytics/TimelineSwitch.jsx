import React from 'react';
import { subDays, subMonths, startOfYear } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TIMELINE_OPTIONS = [
  { label: '1D', value: '1D', getRange: () => ({ from: subDays(new Date(), 1), to: new Date() }) },
  { label: '5D', value: '5D', getRange: () => ({ from: subDays(new Date(), 5), to: new Date() }) },
  { label: '1M', value: '1M', getRange: () => ({ from: subMonths(new Date(), 1), to: new Date() }) },
  { label: '6M', value: '6M', getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: 'YTD', value: 'YTD', getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
  { label: '1Y', value: '1Y', getRange: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
  { label: '5Y', value: '5Y', getRange: () => ({ from: subMonths(new Date(), 60), to: new Date() }) },
  { label: 'Max', value: 'Max', getRange: () => ({ from: subMonths(new Date(), 120), to: new Date() }) },
];

export function getPeriodForTimelineRange(range) {
  if (['1D', '5D', '1M'].includes(range)) return 'daily';
  if (['6M', '1Y', 'YTD'].includes(range)) return 'monthly';
  if (['5Y', 'Max'].includes(range)) return 'yearly';
  return 'monthly';
}

export function TimelineSwitch({ value, onChange, className }) {
  const handleSelect = (val) => {
    if (onChange) {
      const option = TIMELINE_OPTIONS.find(opt => opt.value === val);
      if (option) {
        const period = getPeriodForTimelineRange(option.value);
        onChange(option.value, option.getRange(), period);
      }
    }
  };

  return (
    <div className={className}>
      <Select value={value} onValueChange={handleSelect}>
        <SelectTrigger className="w-[85px] h-8 text-xs font-semibold bg-background border-border">
          <SelectValue placeholder="Timeline" />
        </SelectTrigger>
        <SelectContent>
          {TIMELINE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
