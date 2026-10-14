/**
 * PpsForm — Hospital Portal (baseline Palliative Performance Scale).
 *
 * Ported from frontend/src/pages/patients/tabs/PpsForm.jsx, repointed at the
 * portal baseline API. Receives the `pps` slice of the baseline bundle and
 * persists via onSave('pps', payload) → PUT /baseline/pps.
 *
 * The per-visit "Smart PPS Suggestion" (AI) from the main app is omitted — the
 * portal baseline contract has no suggest endpoint. The priority-based default
 * (defaultPpsForPriority) is kept for first-time defaulting.
 *
 * Props: { data, editable, onSave, patientComplexity }
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Info } from 'lucide-react';
import { defaultPpsForPriority } from '../../utils/ppsPriorityMap';

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

export default function PpsForm({ data, editable = false, onSave, patientComplexity = null }) {
  const [selectedScore, setSelectedScore] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usedPriorityDefault, setUsedPriorityDefault] = useState(false);

  useEffect(() => {
    if (data && data.pps_score != null) {
      setSelectedScore(data.pps_score);
      setNotes(data.notes || '');
      setUsedPriorityDefault(false);
    } else {
      const def = defaultPpsForPriority(patientComplexity);
      setSelectedScore(def);
      setNotes(data?.notes || '');
      setUsedPriorityDefault(def !== null);
    }
  }, [data, patientComplexity]);

  const selectedRow = PPS_TABLE.find(r => r.score === selectedScore);

  const handleSave = async () => {
    if (!editable || !onSave) return;
    if (selectedScore === null) {
      alert('Please select a PPS score');
      return;
    }
    setSaving(true);
    try {
      await onSave('pps', {
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
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save PPS score');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
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

      {editable && usedPriorityDefault && patientComplexity && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-400 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Pre-selected <strong>PPS {selectedScore}%</strong> based on the patient's
            priority (<strong>{patientComplexity}</strong>). Click any row to adjust,
            or save as-is to confirm.
          </span>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-0 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1 px-2 py-2 border-r border-border">%</div>
          <div className="col-span-2 px-2 py-2 border-r border-border">Ambulation</div>
          <div className="col-span-3 px-2 py-2 border-r border-border">Activity Level</div>
          <div className="col-span-2 px-2 py-2 border-r border-border">Self-Care</div>
          <div className="col-span-2 px-2 py-2 border-r border-border">Intake</div>
          <div className="col-span-2 px-2 py-2">Consciousness</div>
        </div>

        {PPS_TABLE.map(row => {
          const isSelected = selectedScore === row.score;
          const rowColor = row.score >= 70 ? 'hover:bg-green-500/5' : row.score >= 40 ? 'hover:bg-yellow-500/5' : 'hover:bg-red-500/5';
          const selectedBg = row.score >= 70 ? 'bg-green-500/15 border-l-green-500' : row.score >= 40 ? 'bg-yellow-500/15 border-l-yellow-500' : 'bg-red-500/15 border-l-red-500';

          return (
            <div
              key={row.score}
              onClick={() => { if (editable) setSelectedScore(row.score); }}
              className={`grid grid-cols-12 gap-0 transition-colors border-b border-border/50 last:border-0 border-l-3
                ${editable ? 'cursor-pointer' : 'cursor-default'}
                ${isSelected ? `${selectedBg} border-l-4` : `border-l-transparent ${editable ? rowColor : ''}`}`}
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

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <textarea
          rows={3}
          placeholder="Additional observations about functional status..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={!editable}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60"
        />
      </div>

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save PPS Score'}
          </button>
        </div>
      )}
    </div>
  );
}
