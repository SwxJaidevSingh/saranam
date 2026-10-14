import { useState } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import homecareApi from '../../api/homecare';

// ---- Sub-section wrapper ----
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

function SelectField({ label, value, onChange, disabled, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-60"
      >
        <option value="">-- Select --</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

// ---- Diagnosis rows ----
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
            <input type="text" placeholder="M54.5" value={row.diagnosis_code} onChange={e => update(i, 'diagnosis_code', e.target.value)} disabled={disabled}
              className="w-full px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm disabled:opacity-60" />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-muted-foreground mb-1">Diagnosis *</label>
            <input type="text" placeholder="e.g. Chronic wound" value={row.diagnosis_name} onChange={e => update(i, 'diagnosis_name', e.target.value)} disabled={disabled}
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

// ---- Equipment checkboxes ----
const EQUIPMENT_OPTIONS = [
  'Hospital Bed',
  'Oxygen Concentrator',
  'Wheelchair',
  'Walking Aid',
  'Suction Machine',
  'Nebulizer',
];

// =====================================================================
// Main Home Care Assessment Component
// =====================================================================
export default function HomeCareAssessmentSection({ visit, onSaved }) {
  const existingData = visit.service_metadata?.homecare_assessment || {};

  // ---- Home Environment Assessment ----
  const [homeAccessibility, setHomeAccessibility] = useState(existingData.home_environment?.home_accessibility || '');
  const [stairs, setStairs] = useState(existingData.home_environment?.stairs || '');
  const [cleanliness, setCleanliness] = useState(existingData.home_environment?.cleanliness || '');
  const [safetyHazards, setSafetyHazards] = useState(existingData.home_environment?.safety_hazards || '');
  const [caregiverPresent, setCaregiverPresent] = useState(existingData.home_environment?.caregiver_present || '');
  const [caregiverName, setCaregiverName] = useState(existingData.home_environment?.caregiver_name || '');
  const [caregiverRelationship, setCaregiverRelationship] = useState(existingData.home_environment?.caregiver_relationship || '');
  const [equipmentAtHome, setEquipmentAtHome] = useState(existingData.home_environment?.equipment_at_home || []);
  const [suppliesNeeded, setSuppliesNeeded] = useState(existingData.home_environment?.supplies_needed || '');

  // ---- Clinical History ----
  const [hpe, setHpe] = useState(existingData.clinical_history?.hpe || '');
  const [chiefComplaints, setChiefComplaints] = useState(existingData.clinical_history?.chief_complaints || '');
  const [historyOfIllness, setHistoryOfIllness] = useState(existingData.clinical_history?.history_of_illness || '');
  const [comorbidities, setComorbidities] = useState(existingData.clinical_history?.comorbidities || '');
  const [medicationHistory, setMedicationHistory] = useState(existingData.clinical_history?.medication_history || '');

  // ---- Personal History ----
  const [personalHistory, setPersonalHistory] = useState(existingData.personal_history || '');

  // ---- Systemic Examination ----
  const [systemicExam, setSystemicExam] = useState(existingData.systemic_examination || '');

  // ---- Care Taker's Notes ----
  const [careTakerNotes, setCareTakerNotes] = useState(existingData.care_taker_notes || '');

  // ---- Diagnoses (ICD) ----
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

  const handleEquipmentToggle = (item) => {
    setEquipmentAtHome(prev =>
      prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
    );
  };

  const handleSave = async () => {
    const validDiagnoses = diagnoses.filter(d => d.diagnosis_name.trim());

    setSaving(true);
    try {
      const assessmentPayload = {
        home_environment: {
          home_accessibility: homeAccessibility,
          stairs,
          cleanliness,
          safety_hazards: safetyHazards,
          caregiver_present: caregiverPresent,
          caregiver_name: caregiverName,
          caregiver_relationship: caregiverRelationship,
          equipment_at_home: equipmentAtHome,
          supplies_needed: suppliesNeeded,
        },
        clinical_history: {
          hpe,
          chief_complaints: chiefComplaints,
          history_of_illness: historyOfIllness,
          comorbidities,
          medication_history: medicationHistory,
        },
        personal_history: personalHistory,
        systemic_examination: systemicExam,
        care_taker_notes: careTakerNotes,
      };
      await homecareApi.saveHomeCareAssessment(visit.id, assessmentPayload);

      // Save diagnoses (ICD entries)
      if (validDiagnoses.length > 0) {
        const diagPayload = validDiagnoses.map(d => ({
          diagnosis_text: d.diagnosis_name,
          icd10_code: d.diagnosis_code || null,
          diagnosis_type: d.diagnosis_type,
          notes: d.notes || null,
        }));
        await homecareApi.saveDiagnoses(visit.id, diagPayload);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save home care assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ---- Home Environment Assessment ---- */}
      <SubSection title="Home Environment Assessment">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <SelectField
            label="Home Accessibility"
            value={homeAccessibility}
            onChange={setHomeAccessibility}
            disabled={isClosed}
            options={['Good', 'Limited', 'Poor']}
          />
          <SelectField
            label="Stairs"
            value={stairs}
            onChange={setStairs}
            disabled={isClosed}
            options={['None', 'Few', 'Many']}
          />
          <SelectField
            label="Cleanliness"
            value={cleanliness}
            onChange={setCleanliness}
            disabled={isClosed}
            options={['Clean', 'Needs Attention', 'Poor']}
          />
        </div>

        <TextField
          label="Safety Hazards"
          placeholder="e.g. Loose rugs, poor lighting, cluttered walkways..."
          value={safetyHazards}
          onChange={setSafetyHazards}
          disabled={isClosed}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SelectField
            label="Caregiver Present"
            value={caregiverPresent}
            onChange={setCaregiverPresent}
            disabled={isClosed}
            options={['Yes', 'No']}
          />
          {caregiverPresent === 'Yes' && (
            <>
              <TextField
                label="Caregiver Name"
                placeholder="Name of caregiver"
                value={caregiverName}
                onChange={setCaregiverName}
                disabled={isClosed}
              />
              <TextField
                label="Caregiver Relationship"
                placeholder="e.g. Spouse, Son, Daughter, Nurse"
                value={caregiverRelationship}
                onChange={setCaregiverRelationship}
                disabled={isClosed}
              />
            </>
          )}
        </div>

        {/* Equipment at Home */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Equipment at Home</label>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map(item => (
              <label key={item} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={equipmentAtHome.includes(item)}
                  onChange={() => handleEquipmentToggle(item)}
                  disabled={isClosed}
                  className="h-4 w-4 rounded border-border"
                />
                {item}
              </label>
            ))}
          </div>
        </div>

        <TextArea
          label="Supplies Needed for Next Visit"
          placeholder="e.g. Wound dressing kit, IV set, sterile gloves, medications..."
          value={suppliesNeeded}
          onChange={setSuppliesNeeded}
          disabled={isClosed}
          rows={2}
        />
      </SubSection>

      {/* ---- Diagnoses ---- */}
      <SubSection title="Diagnosis (ICD Codes)">
        <DiagnosisRows items={diagnoses} setItems={setDiagnoses} disabled={isClosed} />
      </SubSection>

      {/* ---- Clinical History ---- */}
      <SubSection title="Clinical History">
        <TextArea
          label="HPE (History & Physical Examination)"
          placeholder="Detailed history and physical examination findings..."
          value={hpe}
          onChange={setHpe}
          disabled={isClosed}
          rows={3}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextArea
            label="Chief Complaints"
            placeholder="Patient's main complaints..."
            value={chiefComplaints}
            onChange={setChiefComplaints}
            disabled={isClosed}
            rows={2}
          />
          <TextArea
            label="History of Present Illness"
            placeholder="Onset, duration, progression..."
            value={historyOfIllness}
            onChange={setHistoryOfIllness}
            disabled={isClosed}
            rows={2}
          />
          <TextArea
            label="Comorbidities"
            placeholder="DM, HTN, CKD, COPD, etc."
            value={comorbidities}
            onChange={setComorbidities}
            disabled={isClosed}
            rows={2}
          />
          <TextArea
            label="Medication History"
            placeholder="Current medications, recent changes..."
            value={medicationHistory}
            onChange={setMedicationHistory}
            disabled={isClosed}
            rows={2}
          />
        </div>
      </SubSection>

      {/* ---- Personal History ---- */}
      <SubSection title="Personal History">
        <TextArea
          label="Personal History"
          placeholder="Diet, sleep pattern, bowel/bladder habits, substance use..."
          value={personalHistory}
          onChange={setPersonalHistory}
          disabled={isClosed}
          rows={3}
        />
      </SubSection>

      {/* ---- Systemic Examination ---- */}
      <SubSection title="Systemic Examination">
        <TextArea
          label="Systemic Examination"
          placeholder="CVS, RS, P/A, CNS findings..."
          value={systemicExam}
          onChange={setSystemicExam}
          disabled={isClosed}
          rows={3}
        />
      </SubSection>

      {/* ---- Care Taker's Notes ---- */}
      <SubSection title="Care Taker's Notes">
        <TextArea
          label="Clinical Notes / Care Plan"
          placeholder="Overall impression, care plan, goals, instructions for patient and caregiver..."
          value={careTakerNotes}
          onChange={setCareTakerNotes}
          disabled={isClosed}
          rows={4}
        />
      </SubSection>

      {/* ---- Save ---- */}
      {!isClosed && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved!' : 'Save Home Care Assessment'}
          </button>
        </div>
      )}
    </div>
  );
}
