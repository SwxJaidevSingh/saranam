/**
 * PsychologicalAssessmentForm — Hospital Portal (baseline psychological).
 *
 * Ported from frontend/src/pages/patients/tabs/PsychologicalAssessmentForm.jsx
 * and rewritten from MUI to Tailwind so the portal stays free of the @mui/*
 * dependency. Same data model and field keys as the main app. Receives the
 * `psychological` slice of the baseline bundle and persists via
 * onSave('psychological', payload) → PUT /baseline/psychological.
 *
 * Props: { data, editable, onSave }
 */
import { useState, useEffect, useCallback } from 'react';
import { Save, RefreshCw } from 'lucide-react';

const labelize = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const problemCategories = {
  physical: ['pain', 'fatigue', 'nausea', 'sleep', 'mobility', 'appetite', 'constipation', 'breathing', 'skin_changes', 'swelling', 'other_physical'],
  emotional: ['sadness', 'worry', 'fear', 'anger', 'hopelessness', 'guilt', 'loneliness', 'irritability', 'other_emotional'],
  social: ['isolation', 'family_conflict', 'caregiver_burden', 'financial_stress', 'stigma', 'other_social'],
  practical: ['housing', 'transportation', 'medications', 'daily_activities', 'legal_issues', 'other_practical'],
  spiritual: ['meaning', 'faith_crisis', 'guilt_spiritual', 'anger_at_god', 'fear_of_death', 'other_spiritual'],
};

const zaritQuestions = [
  { key: 'zarit_q1_stress', text: 'Do you feel stressed between caregiving and other responsibilities?' },
  { key: 'zarit_q2_time', text: "Do you feel you don't have enough time for yourself?" },
  { key: 'zarit_q3_strain', text: 'Do you feel strained when around the patient?' },
  { key: 'zarit_q4_uncertain', text: 'Do you feel uncertain about what to do about the patient?' },
];

const zaritOptions = [
  { value: 0, label: 'Never' },
  { value: 1, label: 'Rarely' },
  { value: 2, label: 'Sometimes' },
  { value: 3, label: 'Frequently' },
  { value: 4, label: 'Nearly Always' },
];

const getZaritInterpretation = (score) => {
  if (score <= 4) return { text: 'Little or no burden', color: 'text-green-500' };
  if (score <= 8) return { text: 'Mild to moderate burden', color: 'text-yellow-500' };
  if (score <= 12) return { text: 'Moderate to severe burden', color: 'text-orange-500' };
  return { text: 'Severe burden', color: 'text-red-500' };
};

const distressColor = (val) => {
  if (val <= 3) return 'text-green-500';
  if (val <= 6) return 'text-yellow-500';
  return 'text-red-500';
};

const defaultData = () => ({
  patient_mood: '', patient_sleep: '', patient_disease_concerns: '',
  problems_physical: [], problems_emotional: [], problems_social: [],
  problems_practical: [], problems_spiritual: [],
  distress_score: 0,
  family_support_notes: '',
  caregiver_mood: '', caregiver_burden: '',
  caregiver_concerns_about_patient: '', caregiver_personal_concerns: '',
  zarit_q1_stress: 0, zarit_q2_time: 0, zarit_q3_strain: 0, zarit_q4_uncertain: 0,
  remarks: '', ai_summary: '',
});

function SectionHeader({ children }) {
  return (
    <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1 mt-4">{children}</h4>
  );
}

function FieldTextArea({ label, value, onChange, rows = 2, disabled, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea rows={rows} value={value || ''} onChange={onChange} disabled={disabled} placeholder={placeholder}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60" />
    </div>
  );
}

export default function PsychologicalAssessmentForm({ data, editable = false, onSave }) {
  const [form, setForm] = useState(defaultData());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm((prev) => ({ ...defaultData(), ...prev, ...data }));
  }, [data]);

  const set = useCallback((field) => (e) => {
    const val = e?.target !== undefined ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: val }));
  }, []);

  const toggleProblem = useCallback((category, item) => () => {
    if (!editable) return;
    const key = `problems_${category}`;
    setForm((prev) => {
      const list = prev[key] || [];
      const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
      return { ...prev, [key]: next };
    });
  }, [editable]);

  const handleSave = async () => {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      await onSave('psychological', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const zaritTotal = zaritQuestions.reduce((sum, q) => sum + (Number(form[q.key]) || 0), 0);
  const zaritInterp = getZaritInterpretation(zaritTotal);

  return (
    <div className="space-y-3">
      {/* Patient Assessment */}
      <SectionHeader>Patient Assessment</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['patient_mood', 'patient_sleep', 'patient_disease_concerns'].map((f) => (
          <FieldTextArea key={f} label={labelize(f)} value={form[f]} onChange={set(f)} disabled={!editable} />
        ))}
      </div>

      {/* Problem List */}
      <SectionHeader>Problem List</SectionHeader>
      {Object.entries(problemCategories).map(([cat, items]) => (
        <div key={cat} className="mb-2 p-3 rounded-lg bg-muted/20 border border-border">
          <p className="text-sm font-semibold text-foreground mb-1.5">{labelize(cat)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-foreground cursor-pointer min-w-[150px]">
                <input type="checkbox"
                  checked={(form[`problems_${cat}`] || []).includes(item)}
                  onChange={toggleProblem(cat, item)}
                  disabled={!editable}
                  className="h-4 w-4 rounded border-border" />
                {labelize(item)}
              </label>
            ))}
          </div>
        </div>
      ))}

      {/* Distress Thermometer */}
      <SectionHeader>Distress Thermometer</SectionHeader>
      <div className="px-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-green-500">No distress (0)</span>
          <span className={`text-sm font-bold ${distressColor(form.distress_score)}`}>{form.distress_score}/10</span>
          <span className="text-[10px] text-red-500">Extreme (10)</span>
        </div>
        <input type="range" min="0" max="10" step="1" value={form.distress_score ?? 0}
          onChange={(e) => set('distress_score')(parseInt(e.target.value, 10))}
          disabled={!editable}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-60" />
        <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
        </div>
      </div>

      {/* Family Support */}
      <SectionHeader>Family Support</SectionHeader>
      <FieldTextArea label="Family Support Notes" value={form.family_support_notes} onChange={set('family_support_notes')} rows={3} disabled={!editable} />

      {/* Caregiver Assessment */}
      <SectionHeader>Caregiver Assessment</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {['caregiver_mood', 'caregiver_burden', 'caregiver_concerns_about_patient', 'caregiver_personal_concerns'].map((f) => (
          <FieldTextArea key={f} label={labelize(f)} value={form[f]} onChange={set(f)} disabled={!editable} />
        ))}
      </div>

      {/* Zarit Caregiver Burden Screen */}
      <SectionHeader>Zarit Caregiver Burden Screen</SectionHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zaritQuestions.map((q) => (
          <div key={q.key}>
            <p className="text-sm font-medium text-foreground mb-1 leading-snug">{q.text}</p>
            <select value={form[q.key] ?? 0} onChange={set(q.key)} disabled={!editable}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60">
              {zaritOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-1.5 p-3 rounded-lg bg-muted/20 border border-border text-sm text-foreground">
        Total Score: <strong>{zaritTotal}</strong> / 16 —{' '}
        <span className={`font-semibold ${zaritInterp.color}`}>{zaritInterp.text}</span>
      </div>

      {/* Remarks */}
      <SectionHeader>Remarks</SectionHeader>
      <FieldTextArea label="Remarks" value={form.remarks} onChange={set('remarks')} rows={3} disabled={!editable} />

      {/* Summary */}
      <SectionHeader>Summary (editable)</SectionHeader>
      <FieldTextArea label="Summary" value={form.ai_summary} onChange={set('ai_summary')} rows={4} disabled={!editable}
        placeholder="Type a summary..." />

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Psychological Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
