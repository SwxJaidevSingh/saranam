import React from 'react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'alive', label: 'Alive' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'death', label: 'Death' },
];

export function StatusFilter({ value = 'all', onChange, className = '' }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
      title="Filter by Patient Status"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default StatusFilter;
