/**
 * DoctorAssessmentForm — Hospital Portal (baseline doctor assessment).
 *
 * Ported from frontend/src/pages/patients/tabs/DoctorAssessmentForm.jsx,
 * repointed at the portal baseline API. Receives the `doctor` slice of the
 * baseline bundle and persists via onSave('doctor', payload) → PUT /baseline/doctor.
 *
 * Props: { data, editable, onSave }
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';

function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, rows = 3, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea
        rows={rows} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none disabled:opacity-60"
      />
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      />
    </div>
  );
}

function DiagnosisRows({ items, setItems, disabled }) {
  const addRow = () => setItems(p => [...p, { code: '', name: '', type: 'primary', notes: '' }]);
  const removeRow = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setItems(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-lg border border-border">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">ICD Code</label>
            <input type="text" placeholder="C50.9" value={row.code} onChange={e => update(i, 'code', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-muted-foreground mb-1">Diagnosis *</label>
            <input type="text" placeholder="e.g. Ca Breast Stage III" value={row.name} onChange={e => update(i, 'name', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Type</label>
            <select value={row.type} onChange={e => update(i, 'type', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="differential">Differential</option>
              <option value="provisional">Provisional</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <input type="text" placeholder="Optional" value={row.notes} onChange={e => update(i, 'notes', e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          {!disabled && (
            <div className="col-span-1 flex items-end pb-0.5">
              <button onClick={() => removeRow(i)} className="p-1.5 text-red-500 hover:bg-red-900/20 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
      {!disabled && (
        <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
          <Plus className="h-4 w-4" /> Add Diagnosis
        </button>
      )}
      {disabled && items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No diagnoses recorded.</p>
      )}
    </div>
  );
}

export default function DoctorAssessmentForm({ data, editable = false, onSave }) {
  const [hpe, setHpe] = useState('');
  const [chiefComplaints, setChiefComplaints] = useState('');
  const [historyOfIllness, setHistoryOfIllness] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [medicationHistory, setMedicationHistory] = useState('');
  const [previousInvestigations, setPreviousInvestigations] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');

  const [diet, setDiet] = useState('');
  const [appetite, setAppetite] = useState('');
  const [bowel, setBowel] = useState('');
  const [bladder, setBladder] = useState('');
  const [habits, setHabits] = useState('');

  const [respiratory, setRespiratory] = useState('');
  const [cardiovascular, setCardiovascular] = useState('');
  const [perAbdomen, setPerAbdomen] = useState('');
  const [cns, setCns] = useState('');

  const [doctorNotes, setDoctorNotes] = useState('');
  const [diagnoses, setDiagnoses] = useState([]);
  const [aiSummary, setAiSummary] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setHpe(data.hpe_report || '');
    setChiefComplaints(data.chief_complaints || '');
    setHistoryOfIllness(data.history_of_presenting_illness || '');
    setComorbidities(data.comorbidities || '');
    setMedicationHistory(data.medication_history || '');
    setPreviousInvestigations(data.previous_investigations || '');
    setFamilyHistory(data.family_history || '');
    setDiet(data.diet || '');
    setAppetite(data.appetite || '');
    setBowel(data.bowel || '');
    setBladder(data.bladder || '');
    setHabits(data.habits || '');
    setRespiratory(data.exam_respiratory || '');
    setCardiovascular(data.exam_cardiovascular || '');
    setPerAbdomen(data.exam_per_abdomen || '');
    setCns(data.exam_cns || '');
    setDoctorNotes(data.doctor_notes || '');
    setAiSummary(data.ai_summary || '');
    if (data.diagnosis) {
      setDiagnoses([{ code: '', name: data.diagnosis, type: 'primary', notes: '' }]);
    } else {
      setDiagnoses([]);
    }
  }, [data]);

  const handleSave = async () => {
    if (!editable || !onSave) return;
    setSaving(true);
    try {
      const validDiagnoses = diagnoses.filter(d => d.name.trim());
      await onSave('doctor', {
        diagnosis: validDiagnoses.map(d => `${d.code ? `[${d.code}] ` : ''}${d.name} (${d.type})${d.notes ? ` — ${d.notes}` : ''}`).join('; ') || '',
        hpe_report: hpe,
        chief_complaints: chiefComplaints,
        history_of_presenting_illness: historyOfIllness,
        comorbidities,
        medication_history: medicationHistory,
        previous_investigations: previousInvestigations,
        family_history: familyHistory,
        diet,
        appetite,
        bowel,
        bladder,
        habits,
        exam_respiratory: respiratory,
        exam_cardiovascular: cardiovascular,
        exam_per_abdomen: perAbdomen,
        exam_cns: cns,
        doctor_notes: doctorNotes,
        ai_summary: aiSummary,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.error || "Failed to save doctor's assessment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SubSection title="Diagnosis (ICD Codes)">
        <DiagnosisRows items={diagnoses} setItems={setDiagnoses} disabled={!editable} />
      </SubSection>

      <SubSection title="Clinical History">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Diagnosis" placeholder="Diagnosis details / histopathology report..." value={hpe} onChange={setHpe} disabled={!editable} />
          <TextArea label="Chief Complaints" placeholder="Main presenting complaints..." value={chiefComplaints} onChange={setChiefComplaints} disabled={!editable} />
        </div>
        <TextArea label="History of Presenting Illness" placeholder="Detailed history of the current illness, onset, duration, progression..." value={historyOfIllness} onChange={setHistoryOfIllness} disabled={!editable} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Comorbidities" placeholder="DM, HTN, Asthma, etc." value={comorbidities} onChange={setComorbidities} rows={2} disabled={!editable} />
          <TextArea label="Medication History" placeholder="Current and past medications..." value={medicationHistory} onChange={setMedicationHistory} rows={2} disabled={!editable} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Previous Investigations" placeholder="Lab reports, imaging, etc." value={previousInvestigations} onChange={setPreviousInvestigations} rows={2} disabled={!editable} />
          <TextArea label="Family History" placeholder="Relevant family medical history..." value={familyHistory} onChange={setFamilyHistory} rows={2} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="Personal History">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="Diet" placeholder="Veg / Non-veg / Mixed" value={diet} onChange={setDiet} disabled={!editable} />
          <InputField label="Appetite" placeholder="Good / Poor / Reduced" value={appetite} onChange={setAppetite} disabled={!editable} />
          <InputField label="Bowel" placeholder="Normal / Constipation..." value={bowel} onChange={setBowel} disabled={!editable} />
          <InputField label="Bladder" placeholder="Normal / Retention / Incontinence..." value={bladder} onChange={setBladder} disabled={!editable} />
          <InputField label="Habits" placeholder="Smoking, Alcohol, etc." value={habits} onChange={setHabits} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="Systemic Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Respiratory System" placeholder="Findings on respiratory examination..." value={respiratory} onChange={setRespiratory} rows={2} disabled={!editable} />
          <TextArea label="Cardiovascular System" placeholder="Heart sounds, murmurs, JVP..." value={cardiovascular} onChange={setCardiovascular} rows={2} disabled={!editable} />
          <TextArea label="Per Abdomen" placeholder="Soft, non-tender, organomegaly..." value={perAbdomen} onChange={setPerAbdomen} rows={2} disabled={!editable} />
          <TextArea label="Central Nervous System" placeholder="Higher functions, reflexes, motor/sensory..." value={cns} onChange={setCns} rows={2} disabled={!editable} />
        </div>
      </SubSection>

      <SubSection title="Doctor's Notes">
        <TextArea
          label="Clinical Notes / Impression"
          placeholder="Overall clinical impression, plan, advice to patient..."
          value={doctorNotes} onChange={setDoctorNotes} rows={4} disabled={!editable}
        />
        <TextArea
          label="Summary (editable)"
          placeholder="Type a summary..."
          value={aiSummary} onChange={setAiSummary} rows={4} disabled={!editable}
        />
      </SubSection>

      {editable && (
        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : "Save Doctor's Assessment"}
          </button>
        </div>
      )}
    </div>
  );
}
