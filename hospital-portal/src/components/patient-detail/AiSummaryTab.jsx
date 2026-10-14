/**
 * AI Patient Summary tab (Agent B owns this).
 *
 * Reads a read-only AI summary for the patient from the portal endpoint
 * GET /portal/patients/:id/ai-summary (patientsApi.aiSummary). The endpoint
 * returns either:
 *   { summary_blocks: { nursing, psychosocial, physiotherapy }, summary_text,
 *     model_used, generated_at }   — preferred, per the main app's snapshot, or
 *   null                            — when the backend hasn't enabled it yet.
 *
 * This tab is intentionally VIEW-ONLY in the portal: generation/editing of AI
 * summaries stays in the main clinical app. When no summary exists (or the
 * endpoint isn't available) we show a clear empty state rather than an error.
 */
import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { patientsApi } from '../../api/patients'
import { ErrorState, LoadingState, EmptyState } from '../ui/States'
import { dash, formatDateTime } from '../../utils/format'

const BLOCK_LABELS = {
  nursing: 'Nursing Assessment',
  psychosocial: 'Psychosocial Assessment',
  physiotherapy: 'Physiotherapy Assessment',
}

function Block({ title, text }) {
  if (!text || !text.trim()) return null
  return (
    <div>
      <h3 className="text-sm font-semibold text-brand" style={{ color: 'var(--accent-color)' }}>
        {title}
      </h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  )
}

export default function AiSummaryTab({ patientId, patient }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await patientsApi.aiSummary(patientId)
      setSummary(data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load AI summary')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <LoadingState label="Loading AI summary…" />
  if (error) return <ErrorState message={error} onRetry={load} />

  // Normalize blocks: prefer per-block dict, fall back to flat summary_text.
  const blocks = summary?.summary_blocks && typeof summary.summary_blocks === 'object'
    ? summary.summary_blocks
    : {}
  const blockKeys = Object.keys(BLOCK_LABELS)
  const hasBlocks = blockKeys.some((k) => (blocks[k] || '').trim())
  const flatText = summary?.summary_text || ''
  const hasContent = hasBlocks || flatText.trim()

  if (!summary || !hasContent) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No AI summary yet"
        message="An AI patient summary has not been generated for this patient. Summaries are produced from the clinical assessments; once available it will appear here."
      />
    )
  }

  return (
    <div className="card space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: 'var(--accent-color)' }} />
            <h2 className="text-base font-semibold text-foreground">AI Patient Summary</h2>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            AI-drafted narrative across the patient&apos;s assessments. Review before relying on it.
          </p>
        </div>
        {summary.generated_at && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateTime(summary.generated_at)}
            {summary.model_used ? ` · ${summary.model_used}` : ''}
          </span>
        )}
      </div>

      {/* Basic patient details rendered from the loaded patient (deterministic). */}
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Patient</dt>
          <dd className="text-sm font-medium text-foreground">{dash(patient?.full_name)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Diagnosis</dt>
          <dd className="text-sm font-medium text-foreground">{dash(patient?.diagnosis)}</dd>
        </div>
      </dl>

      <div className="space-y-4 border-t border-border pt-4">
        {hasBlocks ? (
          blockKeys.map((k) => <Block key={k} title={BLOCK_LABELS[k]} text={blocks[k]} />)
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{flatText}</p>
        )}
      </div>
    </div>
  )
}
