import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const ACCENT_STYLES = {
  indigo: {
    topLine: 'from-indigo-500 via-blue-500 to-cyan-400',
    glow: 'bg-indigo-500/10 dark:bg-indigo-400/20',
    borderHover: 'hover:border-indigo-400/60 dark:hover:border-indigo-400/50 hover:shadow-indigo-500/10',
    number: 'text-foreground',
  },
  emerald: {
    topLine: 'from-emerald-500 via-teal-500 to-cyan-400',
    glow: 'bg-emerald-500/10 dark:bg-emerald-400/20',
    borderHover: 'hover:border-emerald-400/60 dark:hover:border-emerald-400/50 hover:shadow-emerald-500/10',
    number: 'text-foreground',
  },
  blue: {
    topLine: 'from-blue-600 via-indigo-500 to-sky-400',
    glow: 'bg-blue-500/10 dark:bg-blue-400/20',
    borderHover: 'hover:border-blue-400/60 dark:hover:border-blue-400/50 hover:shadow-blue-500/10',
    number: 'text-foreground',
  },
  amber: {
    topLine: 'from-amber-500 via-orange-500 to-yellow-400',
    glow: 'bg-amber-500/10 dark:bg-amber-400/20',
    borderHover: 'hover:border-amber-400/60 dark:hover:border-amber-400/50 hover:shadow-amber-500/10',
    number: 'text-foreground',
  },
  rose: {
    topLine: 'from-rose-500 via-red-500 to-pink-500',
    glow: 'bg-rose-500/10 dark:bg-rose-400/20',
    borderHover: 'hover:border-rose-400/60 dark:hover:border-rose-400/50 hover:shadow-rose-500/10',
    number: 'text-foreground',
  },
  default: {
    topLine: 'from-primary/80 via-primary/40 to-transparent',
    glow: 'bg-primary/10',
    borderHover: 'hover:border-primary/50 hover:shadow-primary/10',
    number: 'text-foreground',
  },
};

export function StatCard({
  value,
  label,
  isLoading = false,
  variant = 'default',
  className = '',
}) {
  const theme = ACCENT_STYLES[variant] || ACCENT_STYLES.default;
  const isTripleMetric = typeof value === 'string' && value.includes('|');

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card to-muted/20 text-card-foreground px-5 py-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${theme.borderHover} flex flex-col items-center justify-center min-h-[114px] ${className}`}
    >
      {/* Top accent gradient bar */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${theme.topLine}`}
      />

      {/* Subtle ambient radial glow behind the number */}
      <div
        className={`pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-20 w-3/4 rounded-full blur-2xl opacity-60 ${theme.glow} transition-opacity duration-300 group-hover:opacity-100`}
      />

      {isLoading ? (
        <Skeleton className="h-8 w-24 mb-2 rounded-lg" />
      ) : (
        <div
          className={`font-black tracking-tight leading-none mb-2 transition-transform duration-300 group-hover:scale-105 ${
            isTripleMetric
              ? 'text-lg sm:text-xl lg:text-2xl font-bold tracking-normal text-primary dark:text-blue-400'
              : 'text-2xl sm:text-3xl lg:text-4xl'
          } ${theme.number}`}
        >
          {value}
        </div>
      )}

      <div className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug max-w-[92%] line-clamp-2">
        {label}
      </div>
    </div>
  );
}

export default StatCard;
