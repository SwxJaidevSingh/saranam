import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';

/** Merge a calendar date with an HH:mm time string (local timezone). */
export function combineDateAndTime(date, timeStr = '10:00') {
  if (!date) return null;
  const combined = new Date(date);
  const [hours, minutes] = (timeStr || '10:00').split(':').map((v) => parseInt(v, 10));
  combined.setHours(Number.isFinite(hours) ? hours : 10, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return combined;
}

export function ScheduleDateTimePicker({
  selectedDate,
  onSelectDate,
  scheduleTime,
  onScheduleTimeChange,
  onConfirm,
  confirmLabel = 'Confirm Schedule',
  loading = false,
}) {
  return (
    <div className="flex flex-col gap-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelectDate}
        initialFocus
      />
      <div className="space-y-2">
        <Label htmlFor="schedule-time" className="text-xs font-bold uppercase text-muted-foreground">
          Call Time
        </Label>
        <Input
          id="schedule-time"
          type="time"
          value={scheduleTime}
          onChange={(e) => onScheduleTimeChange(e.target.value)}
          className="rounded-xl font-medium"
        />
      </div>
      <Button
        size="sm"
        className="w-full rounded-xl font-bold"
        disabled={!selectedDate || loading}
        onClick={onConfirm}
      >
        {loading ? (
          <>
            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
            Scheduling...
          </>
        ) : (
          confirmLabel
        )}
      </Button>
    </div>
  );
}
