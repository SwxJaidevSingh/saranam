import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import opdApi from '../../api/opd';

// ─── Sub-section wrapper ─────────────────────────────────────────────────────
function SubSection({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{title}</h4>
      {children}
    </div>
  );
}

function TextArea({ label, placeholder, value, onChange, disabled, rows = 3 }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60 resize-none"
      />
    </div>
  );
}

function TextField({ label, placeholder, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      />
    </div>
  );
}

// ─── Diagnosis rows (ICD-based, uses existing API) ───────────────────────────
function DiagnosisRows({ items, setItems, disabled }) {
  const addRow = () => setItems(p => [...p, { diagnosis_code: '', diagnosis_name: '', diagnosis_type: 'primary', notes: '' }]);
  const removeRow = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const update = (i, field, val) => setItems(p => p.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  return (
    <div className="space-y-2">
      {items.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/20 rounded-lg border border-border">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">ICD Code</label>
            <input type="text" placeholder="A00.0" value={row.diagnosis_code} onChange={e => update(i, 'diagnosis_code', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-muted-foreground mb-1">Diagnosis *</label>
            <input type="text" placeholder="e.g. Acute bronchitis" value={row.diagnosis_name} onChange={e => update(i, 'diagnosis_name', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Type</label>
            <select value={row.diagnosis_type} onChange={e => update(i, 'diagnosis_type', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="differential">Differential</option>
              <option value="provisional">Provisional</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <input type="text" placeholder="Optional" value={row.notes} onChange={e => update(i, 'notes', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          {!disabled && (
            <div className="col-span-1 flex items-end pb-0.5">
              <button onClick={() => removeRow(i)} className="p-1.5 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ))}
      {!disabled && (
        <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700">
          <Plus className="h-4 w-4" /> Add Diagnosis
        </button>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Doctor's Assessment Component
// ═════════════════════════════════════════════════════════════════════════════
export default function DoctorAssessmentSection({ visit, onSaved }) {
  const existingDoctorData = visit.service_metadata?.doctor_assessment || {};

  // ── Clinical history state ──
  const [hpe, setHpe] = useState(existingDoctorData.hpe_report || '');
  const [chiefComplaints, setChiefComplaints] = useState(existingDoctorData.chief_complaints || visit.chief_complaint || '');
  const [historyOfIllness, setHistoryOfIllness] = useState(existingDoctorData.history_of_illness || '');
  const [comorbidities, setComorbidities] = useState(existingDoctorData.comorbidities || '');
  const [medicationHistory, setMedicationHistory] = useState(existingDoctorData.medication_history || '');
  const [previousInvestigations, setPreviousInvestigations] = useState(existingDoctorData.previous_investigations || '');
  const [familyHistory, setFamilyHistory] = useState(existingDoctorData.family_history || '');

  // ── Personal history ──
  const [diet, setDiet] = useState(existingDoctorData.personal_history?.diet || '');
  const [appetite, setAppetite] = useState(existingDoctorData.personal_history?.appetite || '');
  const [bowelBladder, setBowelBladder] = useState(existingDoctorData.personal_history?.bowel_bladder || '');
  const [habits, setHabits] = useState(existingDoctorData.personal_history?.habits || '');

  // ── Systemic examination ──
  const [respiratory, setRespiratory] = useState(existingDoctorData.systemic_exam?.respiratory || '');
  const [cardiovascular, setCardiovascular] = useState(existingDoctorData.systemic_exam?.cardiovascular || '');
  const [perAbdomen, setPerAbdomen] = useState(existingDoctorData.systemic_exam?.per_abdomen || '');
  const [cns, setCns] = useState(existingDoctorData.systemic_exam?.cns || '');

  // ── Doctor's notes ──
  const [doctorNotes, setDoctorNotes] = useState(existingDoctorData.doctor_notes || '');

  // ── Diagnoses (ICD) ──
  const [diagnoses, setDiagnoses] = useState(
    (visit.diagnoses || []).map(d => ({
      diagnosis_code: d.icd10_code || d.diagnosis_code || '',
      diagnosis_name: d.diagnosis_text || d.diagnosis_name || '',
      diagnosis_type: d.diagnosis_type || 'primary',
      notes: d.notes || '',
    }))
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isClosed = ['completed', 'no_show', 'cancelled'].includes(visit.status);

  const handleSave = async () => {
    // Validate at least one diagnosis has a name
    const validDiagnoses = diagnoses.filter(d => d.diagnosis_name.trim());

    setSaving(true);
    try {
      // Save doctor's assessment (clinical data)
      const assessmentPayload = {
        hpe_report: hpe,
        chief_complaints: chiefComplaints,
        history_of_illness: historyOfIllness,
        comorbidities,
        medication_history: medicationHistory,
        previous_investigations: previousInvestigations,
        family_history: familyHistory,
        personal_history: { diet, appetite, bowel_bladder: bowelBladder, habits },
        systemic_exam: { respiratory, cardiovascular, per_abdomen: perAbdomen, cns },
        doctor_notes: doctorNotes,
      };
      await opdApi.saveDoctorAssessment(visit.id, assessmentPayload);

      // Save diagnoses (ICD entries)
      if (validDiagnoses.length > 0) {
        const diagPayload = validDiagnoses.map(d => ({
          diagnosis_text: d.diagnosis_name,
          icd10_code: d.diagnosis_code || null,
          diagnosis_type: d.diagnosis_type,
          notes: d.notes || null,
        }));
        await opdApi.saveDiagnoses(visit.id, diagPayload);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save doctor\'s assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Diagnoses ── */}
      <SubSection title="Diagnosis (ICD Codes)">
        <DiagnosisRows items={diagnoses} setItems={setDiagnoses} disabled={isClosed} />
      </SubSection>

      {/* ── HPE & Chief Complaints ── */}
      <SubSection title="Clinical History">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField label="Diagnosis" placeholder="Diagnosis details / histopathology report..." value={hpe} onChange={setHpe} disabled={isClosed} />
          <TextField label="Chief Complaints" placeholder="Main presenting complaints..." value={chiefComplaints} onChange={setChiefComplaints} disabled={isClosed} />
        </div>
        <TextArea label="History of Presenting Illness" placeholder="Detailed history of the current illness, onset, duration, progression..." value={historyOfIllness} onChange={setHistoryOfIllness} disabled={isClosed} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Comorbidities" placeholder="DM, HTN, Asthma, etc." value={comorbidities} onChange={setComorbidities} disabled={isClosed} rows={2} />
          <TextArea label="Medication History" placeholder="Current and past medications..." value={medicationHistory} onChange={setMedicationHistory} disabled={isClosed} rows={2} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Previous Investigations" placeholder="Lab reports, imaging, etc." value={previousInvestigations} onChange={setPreviousInvestigations} disabled={isClosed} rows={2} />
          <TextArea label="Family History" placeholder="Relevant family medical history..." value={familyHistory} onChange={setFamilyHistory} disabled={isClosed} rows={2} />
        </div>
      </SubSection>

      {/* ── Personal History ── */}
      <SubSection title="Personal History">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TextField label="Diet" placeholder="Veg / Non-veg / Mixed" value={diet} onChange={setDiet} disabled={isClosed} />
          <TextField label="Appetite" placeholder="Good / Poor / Reduced" value={appetite} onChange={setAppetite} disabled={isClosed} />
          <TextField label="Bowel & Bladder" placeholder="Normal / Constipation..." value={bowelBladder} onChange={setBowelBladder} disabled={isClosed} />
          <TextField label="Habits" placeholder="Smoking, Alcohol, etc." value={habits} onChange={setHabits} disabled={isClosed} />
        </div>
      </SubSection>

      {/* ── Systemic Examination ── */}
      <SubSection title="Systemic Examination">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea label="Respiratory System" placeholder="Findings on respiratory examination..." value={respiratory} onChange={setRespiratory} disabled={isClosed} rows={2} />
          <TextArea label="Cardiovascular System" placeholder="Heart sounds, murmurs, JVP..." value={cardiovascular} onChange={setCardiovascular} disabled={isClosed} rows={2} />
          <TextArea label="Per Abdomen" placeholder="Soft, non-tender, organomegaly..." value={perAbdomen} onChange={setPerAbdomen} disabled={isClosed} rows={2} />
          <TextArea label="Central Nervous System" placeholder="Higher functions, reflexes, motor/sensory..." value={cns} onChange={setCns} disabled={isClosed} rows={2} />
        </div>
      </SubSection>

      {/* ── Doctor's Notes ── */}
      <SubSection title="Doctor's Notes">
        <TextArea
          label="Clinical Notes / Impression"
          placeholder="Overall clinical impression, plan, advice to patient..."
          value={doctorNotes}
          onChange={setDoctorNotes}
          disabled={isClosed}
          rows={4}
        />
      </SubSection>

      {/* ── Save ── */}
      {!isClosed && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Doctor\'s Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
