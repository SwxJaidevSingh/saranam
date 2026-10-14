/**
 * PpsForm — Palliative Performance Scale (PPS)
 * Clickable table matching the clinical PPS reference chart
 * Score 0-100 in increments of 10
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Loader2, Sparkles, Info, ChevronDown, ChevronUp } from 'lucide-react';
import saranamApi from '../../../api/saranam';
import { defaultPpsForPriority } from '../../../utils/ppsPriorityMap';

const PPS_TABLE = [
  { score: 100, ambulation: 'Full',          activity: 'Normal, No Disease',              selfCare: 'Full',                    intake: 'Normal',          consciousness: 'Full',                    survival: null },
  { score: 90,  ambulation: 'Full',          activity: 'Normal, Some Disease',            selfCare: 'Full',                    intake: 'Normal',          consciousness: 'Full',                    survival: null },
  { score: 80,  ambulation: 'Full',          activity: 'Normal with Effort, Some Disease', selfCare: 'Full',                   intake: 'Normal or Reduced', consciousness: 'Full',                  survival: 108 },
  { score: 70,  ambulation: 'Reduced',       activity: "Can't do normal job/work",        selfCare: 'Full',                    intake: 'Normal or Reduced', consciousness: 'Full',                  survival: 145 },
  { score: 60,  ambulation: 'Reduced',       activity: "Can't do hobbies/housework",      selfCare: 'Occasional Assistance',   intake: 'Normal or Reduced', consciousness: 'Full or Confusion',     survival: 29 },
  { score: 50,  ambulation: 'Mainly Sit/Lie', activity: "Can't do any work",              selfCare: 'Considerable Assistance', intake: 'Normal or Reduced', consciousness: 'Full or Confusion',     survival: 30 },
  { score: 40,  ambulation: 'Mainly in Bed', activity: 'As above',                        selfCare: 'Mainly Assistance',       intake: 'Normal or Reduced', consciousness: 'Full or Drowsy/Confusion', survival: 18 },
  { score: 30,  ambulation: 'Bed Bound',     activity: 'As above',                        selfCare: 'Total Care',              intake: 'Reduced',          consciousness: 'Full or Drowsy/Confusion', survival: 8 },
  { score: 20,  ambulation: 'Bed Bound',     activity: 'As above',                        selfCare: 'As above',                intake: 'Minimal',          consciousness: 'As above',                 survival: 4 },
  { score: 10,  ambulation: 'Bed Bound',     activity: 'As above',                        selfCare: 'As above',                intake: 'Mouth Care Only',  consciousness: 'Drowsy or Coma',           survival: 1 },
  { score: 0,   ambulation: 'Death',         activity: '—',                               selfCare: '—',                       intake: '—',               consciousness: '—',                        survival: null },
];

function getScoreColor(score) {
  if (score >= 70) return 'bg-green-500/15 border-green-500/40 text-green-400';
  if (score >= 40) return 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400';
  return 'bg-red-500/15 border-red-500/40 text-red-400';
}

export default function PpsForm({ visitId, patientId, onSaved, patientComplexity = null }) {
  const [loading, setLoading] = useState(true);
  const [selectedScore, setSelectedScore] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // When `true`, selectedScore was pre-filled from the patient's priority
  // rather than a previously-saved PPS. Used only to show a small hint in the
  // UI so the user understands why a row is pre-highlighted.
  const [usedPriorityDefault, setUsedPriorityDefault] = useState(false);

  // Suggestion state
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  useEffect(() => { loadData(); }, [visitId, patientComplexity]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await saranamApi.getAssessment(visitId, 'pps');
      if (data && data.pps_score != null) {
        // Saved PPS wins over priority-based default.
        setSelectedScore(data.pps_score);
        setNotes(data.notes || '');
        setUsedPriorityDefault(false);
      } else {
        // No saved PPS — fall back to the priority default (top of the band).
        const def = defaultPpsForPriority(patientComplexity);
        setSelectedScore(def);
        setUsedPriorityDefault(def !== null);
      }
    } catch (err) {
      // No saved record → still apply the priority default.
      const def = defaultPpsForPriority(patientComplexity);
      setSelectedScore(def);
      setUsedPriorityDefault(def !== null);
    } finally { setLoading(false); }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const result = await saranamApi.suggestPps(visitId);
      setSuggestion(result);
      setShowReasoning(true);
    } catch (err) {
      alert('Failed to generate suggestion');
    } finally { setSuggesting(false); }
  };

  const applySuggestion = () => {
    if (suggestion?.suggested_score !== null && suggestion?.suggested_score !== undefined) {
      setSelectedScore(suggestion.suggested_score);
      setSuggestion(prev => ({ ...prev, applied: true }));
    }
  };

  const selectedRow = PPS_TABLE.find(r => r.score === selectedScore);

  const handleSave = async () => {
    if (selectedScore === null) {
      alert('Please select a PPS score');
      return;
    }
    setSaving(true);
    try {
      await saranamApi.saveAssessment(visitId, 'pps', {
        pps_score: selectedScore,
        ambulation: selectedRow?.ambulation || '',
        activity_level: selectedRow?.activity || '',
        self_care: selectedRow?.selfCare || '',
        intake: selectedRow?.intake || '',
        consciousness_level: selectedRow?.consciousness || '',
        estimated_survival_days: selectedRow?.survival || null,
        notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save PPS score');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header with selected score */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1 flex-1">
          Palliative Performance Scale (PPS)
        </h4>
        {selectedScore !== null && (
          <div className={`px-3 py-1 rounded-lg border text-lg font-bold ${getScoreColor(selectedScore)}`}>
            PPS {selectedScore}%
            {selectedRow?.survival && (
              <span className="text-xs font-normal ml-2 opacity-70">
                ~{selectedRow.survival} days median survival
              </span>
            )}
          </div>
        )}
      </div>

      {/* Priority-based default hint — shown only when no saved PPS yet */}
      {usedPriorityDefault && patientComplexity && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-400 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Pre-selected <strong>PPS {selectedScore}%</strong> based on the patient's
            priority (<strong>{patientComplexity}</strong>). Click any row to adjust,
            or save as-is to confirm.
          </span>
        </div>
      )}

      {/* ── AI Suggestion Panel ── */}
      <div className="border border-border rounded-lg p-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-foreground">Smart PPS Suggestion</span>
            <span className="text-[10px] text-muted-foreground">(from Nursing, Doctor, ESAS-R, Physiotherapy data)</span>
          </div>
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50 transition-colors"
          >
            {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {suggesting ? 'Analyzing...' : 'Suggest PPS Score'}
          </button>
        </div>

        {suggestion && (
          <div className="mt-3 space-y-2">
            {suggestion.suggested_score !== null ? (
              <>
                {/* Suggested score */}
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-lg border text-lg font-bold ${getScoreColor(suggestion.suggested_score)}`}>
                    PPS {suggestion.suggested_score}%
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      suggestion.confidence === 'high' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                      suggestion.confidence === 'medium' ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400' :
                      'border-gray-500/30 bg-gray-500/10 text-gray-400'
                    }`}>
                      {suggestion.confidence} confidence
                    </span>
                    {!suggestion.applied && (
                      <button
                        onClick={applySuggestion}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                      >
                        Apply Score
                      </button>
                    )}
                    {suggestion.applied && (
                      <span className="text-xs text-green-400 font-medium">Applied</span>
                    )}
                  </div>
                </div>

                {/* Reasoning toggle */}
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  {showReasoning ? 'Hide' : 'Show'} reasoning
                  {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showReasoning && (
                  <div className="space-y-1 pl-4 border-l-2 border-border">
                    {suggestion.reasoning.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {i === 0 ? <strong className="text-foreground">{r}</strong> : r}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">{suggestion.reasoning?.[0] || 'No suggestion available'}</p>
            )}
          </div>
        )}
      </div>

      {/* PPS Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-0 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1 px-2 py-2 border-r border-border">%</div>
          <div className="col-span-2 px-2 py-2 border-r border-border">Ambulation</div>
          <div className="col-span-3 px-2 py-2 border-r border-border">Activity Level</div>
          <div className="col-span-2 px-2 py-2 border-r border-border">Self-Care</div>
          <div className="col-span-2 px-2 py-2 border-r border-border">Intake</div>
          <div className="col-span-2 px-2 py-2">Consciousness</div>
        </div>

        {/* Table rows */}
        {PPS_TABLE.map(row => {
          const isSelected = selectedScore === row.score;
          const rowColor = row.score >= 70 ? 'hover:bg-green-500/5' : row.score >= 40 ? 'hover:bg-yellow-500/5' : 'hover:bg-red-500/5';
          const selectedBg = row.score >= 70 ? 'bg-green-500/15 border-l-green-500' : row.score >= 40 ? 'bg-yellow-500/15 border-l-yellow-500' : 'bg-red-500/15 border-l-red-500';

          return (
            <div
              key={row.score}
              onClick={() => setSelectedScore(row.score)}
              className={`grid grid-cols-12 gap-0 cursor-pointer transition-colors border-b border-border/50 last:border-0 border-l-3
                ${isSelected ? `${selectedBg} border-l-4` : `border-l-transparent ${rowColor}`}`}
            >
              <div className="col-span-1 px-2 py-2 border-r border-border/30">
                <span className={`text-sm font-bold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {row.score}
                </span>
              </div>
              <div className="col-span-2 px-2 py-2 border-r border-border/30 text-xs text-foreground">{row.ambulation}</div>
              <div className="col-span-3 px-2 py-2 border-r border-border/30 text-xs text-foreground">{row.activity}</div>
              <div className="col-span-2 px-2 py-2 border-r border-border/30 text-xs text-foreground">{row.selfCare}</div>
              <div className="col-span-2 px-2 py-2 border-r border-border/30 text-xs text-foreground">{row.intake}</div>
              <div className="col-span-2 px-2 py-2 text-xs text-foreground">{row.consciousness}</div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <textarea
          rows={3}
          placeholder="Additional observations about functional status..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
        />
      </div>

      {/* Save */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save PPS Score'}
        </button>
      </div>
    </div>
  );
}
