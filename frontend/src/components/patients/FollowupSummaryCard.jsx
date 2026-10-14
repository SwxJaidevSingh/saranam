/**
 * FollowupSummaryCard — visit-scoped AI summary for follow-up visits.
 *
 * Per 2026-05-13 client meeting. Mounted on VisitDetailView, only for
 * follow-up visits (initial visits are covered by the patient-level
 * baseline AiPatientSummaryCard).
 *
 * Two actions, no PDF download here (the structured PDF format is task #2):
 *   1. Generate — calls the backend, fills the textarea. Backend pulls
 *      baseline + last 3 prior follow-up summaries + THIS visit's data.
 *   2. Save     — upserts a row in visit_ai_summaries keyed by visit_id.
 *
 * Style matches VisitDetailView (Tailwind + lucide) rather than the
 * patient-level card (MUI).
 */
import React, { useEffect, useState } from 'react';
import {
  Sparkles, Save, Loader2, AlertCircle, CheckCircle, RefreshCw,
} from 'lucide-react';
import saranamApi from '../../api/saranam';
// import BodyMapView from '../common/BodyMapView';


function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}


export default function FollowupSummaryCard({ visit }) {
  const [text, setText] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [pendingModel, setPendingModel] = useState(null);
  const [pendingBodyLocations, setPendingBodyLocations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!visit?.id) return undefined;
    setLoading(true);
    saranamApi.getFollowupSummary(visit.id)
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setSnapshot(res);
          setText(res.summary_text || '');
          setPendingBodyLocations(res.body_locations || null);
        } else {
          setSnapshot(null); setText(''); setPendingBodyLocations(null);
        }
      })
      .catch(() => { if (!cancelled) setSnapshot(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visit?.id]);

  const handleGenerate = async () => {
    setGenerating(true); setError(''); setOkMsg('');
    try {
      const { summary, body_locations, model } =
        await saranamApi.generateFollowupSummary(visit.id);
      setText(summary || '');
      setPendingModel(model || null);
      if (Array.isArray(body_locations)) setPendingBodyLocations(body_locations);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to generate follow-up summary');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!text.trim()) {
      setError('Summary is empty — generate first or type something.');
      return;
    }
    setSaving(true); setError(''); setOkMsg('');
    try {
      const saved = await saranamApi.saveFollowupSummary(visit.id, {
        summary_text: text,
        body_locations: pendingBodyLocations || [],
        model: pendingModel || snapshot?.model_used || null,
      });
      setSnapshot(saved);
      setOkMsg('Saved.');
      setTimeout(() => setOkMsg(''), 2500);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save follow-up summary');
    } finally {
      setSaving(false);
    }
  };

  // The card is only meaningful for follow-up visits. The parent should also
  // gate this, but we render a benign hint if it slips through.
  if (visit?.visit_type === 'initial') {
    return null;
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-500" />
            Follow-up Visit Summary
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Change-focused note generated from baseline + last 3 follow-up summaries + this visit&apos;s data. Review before saving.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
          >
            {generating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? 'Generating…' : (snapshot ? 'Regenerate' : 'Generate')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || generating || !text.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-muted text-foreground rounded-md text-xs font-medium disabled:opacity-50 transition-colors"
          >
            {saving
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : okMsg
                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : (okMsg || 'Save')}
          </button>
        </div>
      </div>

      {snapshot && (
        <div className="text-[11px] text-muted-foreground mb-2">
          Last saved {formatWhen(snapshot.generated_at)}
          {snapshot.model_used ? ` • ${snapshot.model_used}` : ''}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-md border border-rose-300 bg-rose-50 text-xs text-rose-800">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <textarea
          rows={6}
          placeholder="Click Generate to draft a change-focused summary for this visit. Edit before saving."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-y"
        />
      )}
    </div>
  );
}
