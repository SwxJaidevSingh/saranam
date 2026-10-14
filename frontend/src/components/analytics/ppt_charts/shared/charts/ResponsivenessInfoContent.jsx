import React from 'react';
import { Calculator, Calendar, Clock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Detailed calculation explanation and mathematical formula for
 * Responsiveness Analysis (in Calendar Days).
 */
export function CalendarDaysInfoContent() {
  return (
    <div className="space-y-4 text-xs sm:text-sm text-foreground">
      {/* Overview Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
        <div className="flex items-start gap-2.5">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">
              Gross Calendar Turnaround Time
            </h4>
            <p className="text-xs text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
              Measures the elapsed chronological duration (in consecutive 24-hour calendar days)
              from the day a patient is registered in the palliative registry to the date of their
              very first in-person homecare visit.
            </p>
          </div>
        </div>
      </div>

      {/* Mathematical Formula Card */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
          <Calculator className="h-4 w-4 text-primary" />
          <span>Mathematical Formula</span>
        </div>

        <div className="space-y-2.5 font-mono text-xs bg-card p-3 rounded-lg border border-border/80 shadow-inner">
          <div className="text-muted-foreground">// 1. Turnaround per patient (i):</div>
          <div className="pl-3 py-1 font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-500">
            Elapsed Calendar Days = Date(First In-Person Visit) - Date(Registration)
          </div>

          <div className="text-muted-foreground pt-1">// 2. Monthly Average Turnaround:</div>
          <div className="pl-3 py-1 font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-500">
            Monthly Avg = Σ (Elapsed Calendar Days) / Total Visited Patients in Month
          </div>

          <div className="text-muted-foreground pt-1">// 3. Overall Average:</div>
          <div className="pl-3 py-1 font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-500">
            Overall Avg = Σ (All Elapsed Calendar Days) / Total Contacted Patients
          </div>
        </div>
      </div>

      {/* Methodology Rules */}
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Key Calculation Rules & Data Points
        </h4>

        <div className="grid gap-2 text-xs">
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Registration Anchor (T₀):</strong>{' '}
              <span className="text-muted-foreground">
                Extracted from the patient's recorded registration date (or creation timestamp if not recorded).
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">First Contact Anchor (T₁):</strong>{' '}
              <span className="text-muted-foreground">
                The earliest in-person palliative visit recorded with status <code className="text-primary font-mono">completed</code> or <code className="text-primary font-mono">in_progress</code>.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Teleconsultation Filter:</strong>{' '}
              <span className="text-muted-foreground">
                Phone consultations and virtual triage calls are explicitly excluded so the metric strictly measures physical mobile unit response.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <Calendar className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Calendar Days Counted:</strong>{' '}
              <span className="text-muted-foreground">
                All 7 calendar days of the week (Monday through Sunday, including weekends and public holidays) are counted continuously.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Practical Example */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1.5">
        <div className="font-semibold text-foreground">Example Walkthrough:</div>
        <p className="text-muted-foreground leading-relaxed">
          If Patient A is registered on <strong className="text-foreground">Friday, Oct 1</strong> and receives their first home visit on <strong className="text-foreground">Monday, Oct 11</strong>, the elapsed duration is <span className="font-semibold text-blue-600 dark:text-blue-400">10 calendar days</span> (Oct 1 to Oct 11).
        </p>
      </div>
    </div>
  );
}

/**
 * Detailed calculation explanation and mathematical formula for
 * Responsiveness Analysis (in Homecare Days).
 */
export function HomecareDaysInfoContent() {
  return (
    <div className="space-y-4 text-xs sm:text-sm text-foreground">
      {/* Overview Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
        <div className="flex items-start gap-2.5">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">
              Operational Clinical Deployment Days
            </h4>
            <p className="text-xs text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
              Measures elapsed time strictly based on <strong>active field working days</strong> of the
              palliative mobile vehicle team. It isolates true clinical team speed by removing non-operational
              days (such as weekends and administrative/OPD days).
            </p>
          </div>
        </div>
      </div>

      {/* Mathematical Formula Card */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-foreground text-xs uppercase tracking-wider">
          <Calculator className="h-4 w-4 text-primary" />
          <span>Mathematical Formula</span>
        </div>

        <div className="space-y-2.5 font-mono text-xs bg-card p-3 rounded-lg border border-border/80 shadow-inner">
          <div className="text-muted-foreground">// 1. Homecare days per patient (i):</div>
          <div className="pl-3 py-1 font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 leading-relaxed">
            Elapsed Homecare Days = Σ [ 1 if Day d ∈ Active Homecare Schedule, else 0 ]
            <br />
            <span className="text-[11px] text-muted-foreground font-normal">
              for each date d from (Registration Date + 1) through (First Visit Date)
            </span>
          </div>

          <div className="text-muted-foreground pt-1">// 2. Monthly Average:</div>
          <div className="pl-3 py-1 font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-500">
            Monthly Avg = Σ (Elapsed Homecare Days) / Total Visited Patients in Month
          </div>

          <div className="text-muted-foreground pt-1">// 3. Overall Average:</div>
          <div className="pl-3 py-1 font-semibold text-blue-600 dark:text-blue-400 border-l-2 border-blue-500">
            Overall Avg = Σ (All Elapsed Homecare Days) / Total Contacted Patients
          </div>
        </div>
      </div>

      {/* Clinical Protocol & Schedule Rules */}
      <div className="space-y-2">
        <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Clinical Protocol & Active Days Rules
        </h4>

        <div className="grid gap-2 text-xs">
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Standard 4-Day Field Protocol:</strong>{' '}
              <span className="text-muted-foreground">
                Per clinical operating standards, active homecare days are <strong className="text-foreground">Monday, Tuesday, Thursday, and Friday</strong>.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Excluded Non-Field Days:</strong>{' '}
              <span className="text-muted-foreground">
                <strong className="text-foreground">Wednesdays</strong> (designated for hospital OPD consultations, clinical team conferences, and administrative reviews) and <strong className="text-foreground">Weekends (Saturday & Sunday)</strong> are excluded from the elapsed count.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <Calendar className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Dynamic Vehicle Schedule Resolution:</strong>{' '}
              <span className="text-muted-foreground">
                The algorithm automatically inspects <code className="text-primary font-mono">daily_vehicle_schedules.homecare_days_at_schedule</code>. If a schedule operated 5 days (Mon–Fri) or 6 days (Mon–Sat) during a specific period, the calculation dynamically incorporates those active days.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">First Contact Anchor:</strong>{' '}
              <span className="text-muted-foreground">
                Earliest in-person home visit with status <code className="text-primary font-mono">completed</code> or <code className="text-primary font-mono">in_progress</code> (teleconsults excluded).
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Practical Comparison Example */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1.5">
        <div className="font-semibold text-foreground">Example Comparison:</div>
        <p className="text-muted-foreground leading-relaxed">
          If Patient A is registered on <strong className="text-foreground">Friday, Oct 1</strong> and visited on <strong className="text-foreground">Monday, Oct 11</strong>:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
          <div className="p-2 rounded bg-card border border-border">
            <span className="text-muted-foreground block text-[10px] font-sans">Calendar Days:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">10 Calendar Days</span>
            <span className="text-muted-foreground text-[10px] block font-sans">(all consecutive days)</span>
          </div>
          <div className="p-2 rounded bg-card border border-border">
            <span className="text-muted-foreground block text-[10px] font-sans">Homecare Days:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">5 Homecare Days</span>
            <span className="text-muted-foreground text-[10px] block font-sans">(Mon 4, Tue 5, Thu 7, Fri 8, Mon 11)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default {
  CalendarDaysInfoContent,
  HomecareDaysInfoContent,
};
