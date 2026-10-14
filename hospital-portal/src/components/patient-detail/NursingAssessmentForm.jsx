/**
 * NursingAssessmentForm — Hospital Portal (baseline nursing assessment).
 *
 * Ported from frontend/src/pages/patients/tabs/NursingAssessmentForm.jsx and
 * repointed at the portal baseline API. Instead of loading/saving per-visit,
 * this receives the `data` slice from the baseline bundle and persists via the
 * parent `onSave('nursing', payload)` callback (→ PUT /baseline/nursing).
 *
 * Props: { data, editable, onSave }
 *   data     — nursing slice of the baseline bundle (or null)
 *   editable — when false all inputs are disabled and Save is hidden
 *   onSave   — async (form, payload) => void
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';

// ─── Toggle button group ──────────────────────────────────────────────────
function RadioGroup({ label, options, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          const active = value === val;
          return (
            <button
              key={val}
              type="button"
              disabled={disabled}
              onClick={() => onChange(val)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-60
                ${active
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-background text-foreground border-border hover:bg-accent'}`}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function PainSlider({ value, onChange, disabled }) {
  const score = value ?? 0;
  const color = score <= 3 ? 'text-green-500' : score <= 6 ? 'text-yellow-500' : 'text-red-500';
  const label = score === 0 ? 'None' : score <= 3 ? 'Mild' : score <= 6 ? 'Moderate' : 'Severe';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">Pain Score (0-10)</label>
        <span className={`text-sm font-bold ${color}`}>{score}/10 — {label}</span>
      </div>
      <input
        type="range" min="0" max="10" value={score}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-60"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0 None</span><span>3 Mild</span><span>6 Moderate</span><span>10 Severe</span>
      </div>
    </div>
  );
}

const SYMPTOM_CHECKBOXES = [
  { key: 'feeding_tube', label: 'Feeding Tubes' },
  { key: 'urinary_catheter', label: 'Urinary Catheter' },
  { key: 'tracheostomy', label: 'Tracheostomy' },
  { key: 'lymphedema', label: 'Lymphoedema' },
];

const SYMPTOM_TEXT_FIELDS = [
  { key: 'nausea_vomiting', label: 'Nausea & Vomiting' },
  { key: 'wound', label: 'Wound (size, site, type, discharge)' },
  { key: 'bed_sore', label: 'Bed Sore (Braden Scale Score)' },
  { key: 'bowel', label: 'Bowel' },
  { key: 'bladder', label: 'Bladder' },
  { key: 'dyspnea', label: 'Dyspnea' },
  { key: 'stoma', label: 'Stoma (site, patent, skin, complications)' },
  { key: 'other_symptoms', label: 'Other Symptoms' },
];

export default function NursingAssessmentForm({ data, editable = false, onSave }) {
  const [gpe, setGpe] = useState({
    consciousness: '', orientation: '', adl: '', built: '', hygiene_general: '',
  });
  const [pain, setPain] = useState({ pain_score: 0, pain_details: '' });
  const [symptoms, setSymptoms] = useState({
    nausea_vomiting: '', wound: '', feeding_tube: false,
    urinary_catheter: false, tracheostomy: false, lymphedema: false,
    bed_sore: '', bowel: '', bladder: '', dyspnea: '',
    stoma: '', other_symptoms: '', remarks: '',
  });
  const [hygieneNotes, setHygieneNotes] = useState('');
  const [procedures, setProcedures] = useState('');
  const [futurePlans, setFuturePlans] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setGpe({
      consciousness: data.consciousness || '',
      orientation: data.orientation || '',
      adl: data.adl || '',
      built: data.built || '',
      hygiene_general: data.hygiene_general || '',
    });
    setPain({ pain_score: data.pain_score || 0, pain_details: data.pain_details || '' });
    setSymptoms({
      nausea_vomiting: data.nausea_vomiting || '',
      wound: data.wound_size || '',
      feeding_tube: data.device_feeding_tube?.present || false,
      urinary_catheter: data.device_urinary_catheter?.present || false,
      tracheostomy: data.device_tracheostomy?.present || false,
      lymphedema: data.lymphedema_present || false,
      bed_sore: data.bed_sore_present ? `Braden: ${data.braden_scale_score || ''}` : '',
      bowel: data.bowel || '', bladder: data.bladder || '',
      dyspnea: data.dyspnea || '', stoma: data.stoma || '',
      other_symptoms: data.other_symptoms || '', remarks: data.remarks || '',
    });
    setHygieneNotes(data.hygiene_notes || '');
    setProcedures(data.procedures_done || '');
    setFuturePlans(data.future_plans || '');
    setSummary(data.ai_summary || '');
  }, [data]);

  const handleSave = async () => {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      await onSave('nursing', {
        consciousness: gpe.consciousness,
        orientation: gpe.orientation,
        adl: gpe.adl,
        built: gpe.built,
        hygiene_general: gpe.hygiene_general,
        pain_score: pain.pain_score,
        pain_details: pain.pain_details,
        nausea_vomiting: symptoms.nausea_vomiting,
        bowel: symptoms.bowel,
        bladder: symptoms.bladder,
        dyspnea: symptoms.dyspnea,
        stoma: symptoms.stoma,
        other_symptoms: symptoms.other_symptoms,
        remarks: symptoms.remarks,
        wound_present: !!symptoms.wound,
        wound_size: symptoms.wound,
        device_feeding_tube: { present: symptoms.feeding_tube },
        device_urinary_catheter: { present: symptoms.urinary_catheter },
        device_tracheostomy: { present: symptoms.tracheostomy },
        device_stoma: { present: !!symptoms.stoma },
        lymphedema_present: symptoms.lymphedema,
        bed_sore_present: !!symptoms.bed_sore,
        hygiene_notes: hygieneNotes,
        procedures_done: procedures,
        future_plans: futurePlans,
        ai_summary: summary,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save nursing assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SubSection title="General Physical Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <RadioGroup label="State of Patient"
            options={['Conscious', 'Semi-conscious', 'Unconscious']}
            value={gpe.consciousness} onChange={v => setGpe(p => ({ ...p, consciousness: v }))} disabled={!editable} />
          <RadioGroup label="Orientation"
            options={['Oriented', 'Disoriented', 'Calm', 'Agitated', 'Restless']}
            value={gpe.orientation} onChange={v => setGpe(p => ({ ...p, orientation: v }))} disabled={!editable} />
          <RadioGroup label="ADL (Activities of Daily Living)"
            options={[{ value: 'Independent', label: 'Independent' }, { value: 'With Support', label: 'With Support' }, { value: 'Bedridden', label: 'Bedridden' }]}
            value={gpe.adl} onChange={v => setGpe(p => ({ ...p, adl: v }))} disabled={!editable} />
          <RadioGroup label="Built"
            options={['Underweight', 'Moderate', 'Overweight']}
            value={gpe.built} onChange={v => setGpe(p => ({ ...p, built: v }))} disabled={!editable} />
          <RadioGroup label="Hygiene"
            options={['Poor', 'Fair', 'Good']}
            value={gpe.hygiene_general} onChange={v => setGpe(p => ({ ...p, hygiene_general: v }))} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="Pain Assessment">
        <PainSlider value={pain.pain_score} onChange={v => setPain(p => ({ ...p, pain_score: v }))} disabled={!editable} />
        <div className="mt-2">
          <label className="block text-xs text-muted-foreground mb-1">Pain Description</label>
          <input type="text" placeholder="Location, nature, aggravating/relieving factors..."
            value={pain.pain_details} onChange={e => setPain(p => ({ ...p, pain_details: e.target.value }))}
            disabled={!editable}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60" />
        </div>
      </SubSection>

      <SubSection title="Symptom Assessment">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {SYMPTOM_CHECKBOXES.map(f => (
            <label key={f.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={!!symptoms[f.key]}
                onChange={e => setSymptoms(p => ({ ...p, [f.key]: e.target.checked }))}
                disabled={!editable}
                className="h-4 w-4 rounded border-border" />
              {f.label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SYMPTOM_TEXT_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
              <input type="text" placeholder={f.label}
                value={symptoms[f.key] || ''} onChange={e => setSymptoms(p => ({ ...p, [f.key]: e.target.value }))}
                disabled={!editable}
                className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60" />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <label className="block text-xs text-muted-foreground mb-1">Remarks</label>
          <textarea rows={2} placeholder="Additional observations..."
            value={symptoms.remarks || ''} onChange={e => setSymptoms(p => ({ ...p, remarks: e.target.value }))}
            disabled={!editable}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
        </div>
      </SubSection>

      <SubSection title="Hygiene Assessment">
        <label className="block text-xs font-medium text-muted-foreground mb-1">Hygiene Notes</label>
        <textarea rows={3} placeholder="Environmental, oral, and skin hygiene observations..."
          value={hygieneNotes}
          onChange={e => setHygieneNotes(e.target.value)}
          disabled={!editable}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
      </SubSection>

      <SubSection title="Visit Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Procedures & Instructions Given</label>
            <textarea rows={3} placeholder="Procedures performed, instructions given..."
              value={procedures} onChange={e => setProcedures(e.target.value)}
              disabled={!editable}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Future Plans & Suggestions</label>
            <textarea rows={3} placeholder="Recommendations, follow-up plans..."
              value={futurePlans} onChange={e => setFuturePlans(e.target.value)}
              disabled={!editable}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Summary (editable)</label>
          <textarea rows={4} placeholder="Type a summary..."
            value={summary} onChange={e => setSummary(e.target.value)}
            disabled={!editable}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
        </div>
      </SubSection>

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Nursing Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
