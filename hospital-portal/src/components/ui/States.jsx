/**
 * Small presentational helpers reused across data views:
 * loading spinner, empty state, error state.
 */
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'

export function LoadingState({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-muted-foreground ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-secondary p-4 text-muted-foreground">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-danger-50 p-4 text-danger-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">Unable to load</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button type="button" className="btn-outline mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function InlineSpinner({ className = '' }) {
  return <span className={`spinner ${className}`} aria-hidden="true" />
}
