/**
 * EsasRForm — Hospital Portal (baseline ESAS-R).
 *
 * Ported from frontend/src/pages/patients/tabs/EsasRForm.jsx, repointed at the
 * portal baseline API. Receives the `esas` slice of the baseline bundle and
 * persists via onSave('esas', payload) → PUT /baseline/esas.
 *
 * Props: { data, editable, onSave }
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';

const SYMPTOMS = [
  { key: 'pain', label: 'Pain', low: 'No pain', high: 'Worst pain' },
  { key: 'tiredness', label: 'Tiredness', low: 'No tiredness', high: 'Worst tiredness' },
  { key: 'nausea', label: 'Nausea', low: 'No nausea', high: 'Worst nausea' },
  { key: 'depression', label: 'Depression', low: 'Not depressed', high: 'Worst depression' },
  { key: 'anxiety', label: 'Anxiety', low: 'Not anxious', high: 'Worst anxiety' },
  { key: 'drowsiness', label: 'Drowsiness', low: 'Not drowsy', high: 'Worst drowsiness' },
  { key: 'appetite', label: 'Appetite', low: 'Best appetite', high: 'Worst appetite' },
  { key: 'wellbeing', label: 'Wellbeing', low: 'Best wellbeing', high: 'Worst wellbeing' },
  { key: 'shortness_of_breath', label: 'Shortness of Breath', low: 'No shortness', high: 'Worst shortness' },
];

function getScoreColor(score) {
  if (score <= 3) return 'text-green-500';
  if (score <= 6) return 'text-yellow-500';
  return 'text-red-500';
}

function getScoreBg(score) {
  if (score <= 3) return 'bg-green-500/10 border-green-500/30';
  if (score <= 6) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function SymptomRow({ label, low, high, value, onChange, disabled }) {
  const score = value ?? 0;
  return (
    <div className="grid grid-cols-12 items-center gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="col-span-3 sm:col-span-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="col-span-0 sm:col-span-2 hidden sm:block">
        <span className="text-[10px] text-muted-foreground">{low}</span>
      </div>
      <div className="col-span-6 sm:col-span-5 px-1">
        <input
          type="range" min="0" max="10" value={score}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-60"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
        </div>
      </div>
      <div className="col-span-0 sm:col-span-1 hidden sm:block">
        <span className="text-[10px] text-muted-foreground">{high}</span>
      </div>
      <div className="col-span-3 sm:col-span-2 text-right">
        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getScoreBg(score)} ${getScoreColor(score)}`}>
          {score}/10
        </span>
      </div>
    </div>
  );
}

export default function EsasRForm({ data, editable = false, onSave }) {
  const [scores, setScores] = useState({
    pain: 0, tiredness: 0, nausea: 0, depression: 0, anxiety: 0,
    drowsiness: 0, appetite: 0, wellbeing: 0, shortness_of_breath: 0,
  });
  const [otherName, setOtherName] = useState('');
  const [otherScore, setOtherScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const loaded = {};
    SYMPTOMS.forEach(s => { loaded[s.key] = data[s.key] ?? 0; });
    setScores(loaded);
    setOtherName(data.other_symptom_name || '');
    setOtherScore(data.other_symptom_score ?? 0);
  }, [data]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) + otherScore;

  const handleSave = async () => {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      await onSave('esas', {
        ...scores,
        other_symptom_name: otherName || null,
        other_symptom_score: otherScore,
        total_score: totalScore,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save ESAS-R');
    } finally { setSaving(false); }
  };

  const totalColor = totalScore <= 30 ? 'text-green-500 border-green-500/30 bg-green-500/10'
    : totalScore <= 60 ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
      : 'text-red-500 border-red-500/30 bg-red-500/10';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1 flex-1">
          ESAS-R Symptom Scores
        </h4>
        <div className={`px-3 py-1 rounded-lg border text-sm font-bold ${totalColor}`}>
          Total: {totalScore}/100
        </div>
      </div>

      <div className="border border-border rounded-lg p-3">
        {SYMPTOMS.map(s => (
          <SymptomRow
            key={s.key}
            label={s.label}
            low={s.low}
            high={s.high}
            value={scores[s.key]}
            onChange={v => setScores(p => ({ ...p, [s.key]: v }))}
            disabled={!editable}
          />
        ))}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> 0-3 Mild</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 4-6 Moderate</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> 7-10 Severe</span>
      </div>

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save ESAS-R Scores'}
          </button>
        </div>
      )}
    </div>
  );
}
