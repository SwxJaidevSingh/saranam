import { useState } from 'react';
import { Save, RefreshCw, Sparkles } from 'lucide-react';
import opdApi from '../../api/opd';

// ─── Radio group helper ──────────────────────────────────────────────────────
function RadioGroup({ label, name, options, value, onChange, disabled }) {
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

// ─── Sub-section wrapper ─────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

// ─── Pain slider ─────────────────────────────────────────────────────────────
function PainSlider({ value, onChange, disabled }) {
  const score = value ?? 0;
  const color = score <= 3 ? 'text-success-600' : score <= 6 ? 'text-warning-600' : 'text-danger-600';
  const label = score === 0 ? 'None' : score <= 3 ? 'Mild' : score <= 6 ? 'Moderate' : 'Severe';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">Pain Score (0-10)</label>
        <span className={`text-sm font-bold ${color}`}>{score}/10 — {label}</span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={score}
        onChange={e => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-60"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>0 None</span><span>3 Mild</span><span>6 Moderate</span><span>10 Severe</span>
      </div>
    </div>
  );
}

// ─── Vitals fields ───────────────────────────────────────────────────────────
const VITAL_FIELDS = [
  { key: 'pulse', label: 'PR (Pulse)', unit: 'bpm', placeholder: '72' },
  { key: 'blood_pressure_systolic', label: 'BP Systolic', unit: 'mmHg', placeholder: '120' },
  { key: 'blood_pressure_diastolic', label: 'BP Diastolic', unit: 'mmHg', placeholder: '80' },
  { key: 'respiratory_rate', label: 'RR', unit: '/min', placeholder: '16' },
  { key: 'temperature', label: 'Temp', unit: '°F', placeholder: '98.6' },
  { key: 'oxygen_saturation', label: 'SpO2', unit: '%', placeholder: '98' },
  { key: 'grbs', label: 'GRBS', unit: 'mg/dL', placeholder: '110' },
  { key: 'weight', label: 'Weight', unit: 'kg', placeholder: '70' },
  { key: 'height', label: 'Height', unit: 'cm', placeholder: '170' },
];

// ─── Symptom rows ────────────────────────────────────────────────────────────
const SYMPTOM_TEXT_FIELDS = [
  { key: 'apetite', label: 'Apetite' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'bowel', label: 'Bowel' },
  { key: 'bladder', label: 'Bladder' },
  { key: 'other_symptoms', label: 'Other Symptoms' },
];

const SYMPTOM_CHECKBOXES = [
  { key: 'feeding_tubes', label: 'Feeding Tubes' },
  { key: 'urinary_catheter', label: 'Urinary Catheter' },
  { key: 'tracheostomy', label: 'Tracheostomy' },
  { key: 'lymphoedema', label: 'Lymphoedema' },
];

// ─── Generate visit summary on frontend ──────────────────────────────────────
function generateSummary(vitals, assessment) {
  const parts = [];

  const gpe = assessment.general_physical_exam || {};
  if (gpe.state_of_patient) {
    parts.push(`Patient is ${gpe.state_of_patient}, ${gpe.orientation || 'oriented'}, ADL: ${gpe.adl || 'independent'}, Built: ${gpe.built || '-'}, Hygiene: ${gpe.hygiene || '-'}`);
  }

  const vParts = [];
  const bpS = vitals.blood_pressure_systolic;
  const bpD = vitals.blood_pressure_diastolic;
  if (bpS && bpD) vParts.push(`BP ${bpS}/${bpD}`);
  if (vitals.pulse) vParts.push(`PR ${vitals.pulse}`);
  if (vitals.oxygen_saturation) vParts.push(`SpO2 ${vitals.oxygen_saturation}%`);
  if (vitals.temperature) vParts.push(`Temp ${vitals.temperature}°F`);
  if (vitals.respiratory_rate) vParts.push(`RR ${vitals.respiratory_rate}`);
  if (vitals.grbs) vParts.push(`GRBS ${vitals.grbs}`);
  if (vParts.length) parts.push('Vitals: ' + vParts.join(', '));

  const pain = assessment.pain_assessment || {};
  if (pain.score > 0) {
    let s = `Pain score: ${pain.score}/10`;
    if (pain.description) s += ` (${pain.description})`;
    parts.push(s);
  }

  const sym = assessment.symptom_assessment || {};
  const active = [];
  for (const k of ['nausea_vomiting', 'wound', 'dyspnea', 'bed_sore', 'stoma']) {
    if (sym[k] && sym[k] !== 'none' && sym[k] !== '') active.push(k.replace(/_/g, ' '));
  }
  if (sym.feeding_tubes) active.push('feeding tubes');
  if (sym.urinary_catheter) active.push('urinary catheter');
  if (sym.tracheostomy) active.push('tracheostomy');
  if (sym.lymphoedema) active.push('lymphoedema');
  if (active.length) parts.push('Active: ' + active.join(', '));

  if (sym.remarks) parts.push('Remarks: ' + sym.remarks);

  return parts.join('. ') + (parts.length ? '.' : '');
}

// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════
export default function NursingAssessmentSection({ visit, onSaved, apiOverride }) {
  const api = apiOverride || opdApi;
  const existingVitals = visit.vitals?.[0] || {};
  const existingVitalsData = existingVitals.vitals_data || {};
  const existingAssessment = existingVitals.assessment_data || {};
  const existingSummary = existingVitals.visit_summary || '';

  // ── Vitals state ──
  const [vitals, setVitals] = useState(() => {
    const v = {};
    VITAL_FIELDS.forEach(f => { v[f.key] = existingVitalsData[f.key] || ''; });
    return v;
  });

  // ── Assessment state ──
  const [gpe, setGpe] = useState({
    state_of_patient: '',
    orientation: '',
    adl: '',
    built: '',
    hygiene: '',
    ...existingAssessment.general_physical_exam,
  });

  const [pain, setPain] = useState({
    score: 0,
    description: '',
    ...existingAssessment.pain_assessment,
  });

  const [symptoms, setSymptoms] = useState({
    apetite: '', aleep: '', nausea_vomiting: '', wound: '', feeding_tubes: false,
    urinary_catheter: false, tracheostomy: false, lymphoedema: false,
    bed_sore: '', bowel: '', bladder: '', dyspnea: '',
    stoma: '', other_symptoms: '', remarks: '',
    ...existingAssessment.symptom_assessment,
  });

  const [hygiene, setHygiene] = useState({
    environmental: '', oral: '', skin: '',
    ...existingAssessment.hygiene_assessment,
  });

  // ── Visit summary state ──
  const [procedures, setProcedures] = useState(existingAssessment.visit_procedures || '');
  const [futurePlans, setFuturePlans] = useState(existingAssessment.future_plans || '');
  const [summary, setSummary] = useState(existingSummary);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isClosed = ['completed', 'no_show', 'cancelled'].includes(visit.status);

  const handleAutoGenerate = () => {
    const assessment = {
      general_physical_exam: gpe,
      pain_assessment: pain,
      symptom_assessment: symptoms,
      hygiene_assessment: hygiene,
    };
    const vitalsNumeric = {};
    Object.entries(vitals).forEach(([k, v]) => {
      if (v !== '' && v !== null) vitalsNumeric[k] = parseFloat(v);
    });
    const text = generateSummary(vitalsNumeric, assessment);
    let full = text;
    if (procedures) full += `\n\nProcedures & Instructions: ${procedures}`;
    if (futurePlans) full += `\n\nFuture Plans: ${futurePlans}`;
    setSummary(full);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const vitalsPayload = {};
      Object.entries(vitals).forEach(([k, v]) => {
        if (v !== '' && v !== null) vitalsPayload[k] = parseFloat(v);
      });

      const assessmentPayload = {
        general_physical_exam: gpe,
        pain_assessment: pain,
        symptom_assessment: symptoms,
        hygiene_assessment: hygiene,
        visit_procedures: procedures,
        future_plans: futurePlans,
      };

      await api.saveNursingAssessment(visit.id, {
        vitals: vitalsPayload,
        assessment_data: assessmentPayload,
        visit_summary: summary || undefined,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save nursing assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Section 1: General Physical Examination ── */}
      <SubSection title="General Physical Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <RadioGroup
            label="State of Patient"
            name="state_of_patient"
            options={['Conscious', 'Semi-conscious', 'Unconscious']}
            value={gpe.state_of_patient}
            onChange={v => setGpe(p => ({ ...p, state_of_patient: v }))}
            disabled={isClosed}
          />
          <RadioGroup
            label="Orientation"
            name="orientation"
            options={['Oriented', 'Disoriented', 'Calm', 'Agitated', 'Restless']}
            value={gpe.orientation}
            onChange={v => setGpe(p => ({ ...p, orientation: v }))}
            disabled={isClosed}
          />
          <RadioGroup
            label="ADL (Activities of Daily Living)"
            name="adl"
            options={[
              { value: 'Independent', label: 'Independent' },
              { value: 'With support', label: 'With Support' },
              { value: 'Completely bedridden', label: 'Bedridden' },
            ]}
            value={gpe.adl}
            onChange={v => setGpe(p => ({ ...p, adl: v }))}
            disabled={isClosed}
          />
          <RadioGroup
            label="Built"
            name="built"
            options={['Underweight', 'Moderate', 'Overweight']}
            value={gpe.built}
            onChange={v => setGpe(p => ({ ...p, built: v }))}
            disabled={isClosed}
          />
          <RadioGroup
            label="Hygiene"
            name="hygiene"
            options={['Poor', 'Fair', 'Good']}
            value={gpe.hygiene}
            onChange={v => setGpe(p => ({ ...p, hygiene: v }))}
            disabled={isClosed}
          />
        </div>
      </SubSection>

      {/* ── Section 2: Vitals ── */}
      <SubSection title="Vitals">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {VITAL_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-muted-foreground mb-1">
                {f.label} <span className="text-muted-foreground/50">{f.unit}</span>
              </label>
              <input
                type="number"
                step="any"
                placeholder={f.placeholder}
                value={vitals[f.key]}
                onChange={e => setVitals(p => ({ ...p, [f.key]: e.target.value }))}
                disabled={isClosed}
                className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
              />
            </div>
          ))}
        </div>
      </SubSection>

      {/* ── Section 3: Pain Assessment ── */}
      <SubSection title="Pain Assessment">
        <PainSlider
          value={pain.score}
          onChange={v => setPain(p => ({ ...p, score: v }))}
          disabled={isClosed}
        />
        <div className="mt-2">
          <label className="block text-xs text-muted-foreground mb-1">Pain Description</label>
          <input
            type="text"
            placeholder="Location, nature, aggravating/relieving factors..."
            value={pain.description}
            onChange={e => setPain(p => ({ ...p, description: e.target.value }))}
            disabled={isClosed}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
          />
        </div>
      </SubSection>

      {/* ── Section 4: Symptom Assessment ── */}
      <SubSection title="Symptom Assessment">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {SYMPTOM_CHECKBOXES.map(f => (
            <label key={f.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={!!symptoms[f.key]}
                onChange={e => setSymptoms(p => ({ ...p, [f.key]: e.target.checked }))}
                disabled={isClosed}
                className="h-4 w-4 rounded border-border"
              />
              {f.label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SYMPTOM_TEXT_FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
              <input
                type="text"
                placeholder={f.label}
                value={symptoms[f.key] || ''}
                onChange={e => setSymptoms(p => ({ ...p, [f.key]: e.target.value }))}
                disabled={isClosed}
                className="w-full px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
              />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <label className="block text-xs text-muted-foreground mb-1">Remarks</label>
          <textarea
            rows={2}
            placeholder="Additional observations..."
            value={symptoms.remarks || ''}
            onChange={e => setSymptoms(p => ({ ...p, remarks: e.target.value }))}
            disabled={isClosed}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none"
          />
        </div>
      </SubSection>

      {/* ── Section 5: Hygiene Assessment ── */}
      <SubSection title="Hygiene Assessment">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RadioGroup
            label="Environmental Hygiene"
            name="env_hygiene"
            options={['Clean', 'Needs Attention', 'Poor']}
            value={hygiene.environmental}
            onChange={v => setHygiene(p => ({ ...p, environmental: v }))}
            disabled={isClosed}
          />
          <RadioGroup
            label="Oral Hygiene"
            name="oral_hygiene"
            options={['Good', 'Fair', 'Poor']}
            value={hygiene.oral}
            onChange={v => setHygiene(p => ({ ...p, oral: v }))}
            disabled={isClosed}
          />
          <RadioGroup
            label="Skin Hygiene"
            name="skin_hygiene"
            options={['Intact', 'Dry', 'Moist', 'Broken']}
            value={hygiene.skin}
            onChange={v => setHygiene(p => ({ ...p, skin: v }))}
            disabled={isClosed}
          />
        </div>
      </SubSection>

      {/* ── Section 6: Visit Summary ── */}
      <SubSection title="Visit Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Procedures & Instructions Given</label>
            <textarea
              rows={3}
              placeholder="Procedures performed, instructions given during the visit..."
              value={procedures}
              onChange={e => setProcedures(e.target.value)}
              disabled={isClosed}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Future Plans & Suggestions</label>
            <textarea
              rows={3}
              placeholder="Recommendations, follow-up plans..."
              value={futurePlans}
              onChange={e => setFuturePlans(e.target.value)}
              disabled={isClosed}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">Auto-Generated Summary (editable)</label>
            {!isClosed && (
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate from assessment
              </button>
            )}
          </div>
          <textarea
            rows={4}
            placeholder="Click 'Generate from assessment' or type manually..."
            value={summary}
            onChange={e => setSummary(e.target.value)}
            disabled={isClosed}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none"
          />
        </div>
      </SubSection>

      {/* ── Save button ── */}
      {!isClosed && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Nursing Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
