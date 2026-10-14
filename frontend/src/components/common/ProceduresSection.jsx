/**
 * ProceduresSection — Shared component for recording clinical procedures.
 * Used in both Initial Assessment (baseline) and Follow-Up visits.
 *
 * Props:
 *   visitId   - visit UUID
 *   patientId - patient UUID
 *   onSaved   - optional callback after save
 */
import { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, ClipboardList } from 'lucide-react';
import { saranamApi } from '../../api/saranam';
import { Plus, X } from 'lucide-react';

// ─── Procedure definitions ───────────────────────────────────────
const NURSING_PROCEDURES = [
  { key: 'administration_of_medications', label: 'Administration of medications' },
  { key: 'ambulation_and_positioning', label: 'Ambulation and Positioning' },
  { key: 'application_of_buprenorphine_patches', label: 'Application of buprenorphine patches' },
  { key: 'application_of_fentanyl_patches', label: 'Application of fentanyl patches' },
  { key: 'ascitic_tapping', label: 'Ascitic tapping' },
  { key: 'bed_bath', label: 'Bed bath' },
  { key: 'bereavement_care', label: 'Bereavement care' },
  { key: 'bladder_irrigation', label: 'Bladder irrigation' },
  { key: 'blood_collection_for_investigation', label: 'Blood collection for investigation' },
  { key: 'breathing_exercises', label: 'Breathing exercises' },
  { key: 'change_of_subcutaneous_port', label: 'Change of subcutaneous port' },
  { key: 'chest_physiotherapy', label: 'Chest physiotherapy' },
  { key: 'colostomy_care', label: 'Colostomy care' },
  { key: 'crisis_plan_for_breathlessness', label: 'Crisis plan for breathlessness' },
  { key: 'crisis_plan_for_fall', label: 'Crisis plan for fall' },
  { key: 'crisis_plan_for_hemorrhage', label: 'Crisis plan for hemorrhage' },
  { key: 'crisis_plan_for_maggots', label: 'Crisis plan for maggots' },
  { key: 'crisis_plan_for_syncope', label: 'Crisis plan for syncope' },
  { key: 'diagnosis_and_prognosis_counselling', label: 'Diagnosis and Prognosis counselling' },
  { key: 'end_of_life_counselling', label: 'End of life counselling' },
  { key: 'enema', label: 'Enema' },
  { key: 'fj_peg_tube_care', label: 'FJ/PEG tube care' },
  { key: 'foleys_catheter_care', label: 'Foleys catheter care' },
  { key: 'foleys_catheter_insertion', label: 'Foleys catheter insertion' },
  { key: 'grbs_monitoring', label: 'GRBS monitoring' },
  { key: 'iv_cannulation', label: 'IV cannulation' },
  { key: 'lymphedema_care', label: 'Lymphedema care' },
  { key: 'maggot_dressing', label: 'Maggot dressing' },
  { key: 'medication_prescribed_under_supervision', label: 'Medication prescribed under supervision' },
  { key: 'medication_review', label: 'Medication review' },
  { key: 'nebulization', label: 'Nebulization' },
  { key: 'ng_tube_care', label: 'NG tube care' },
  { key: 'ng_tube_insertion', label: 'NG tube insertion' },
  { key: 'oral_care', label: 'Oral care' },
  { key: 'others_nursing', label: 'Others' },
  { key: 'pain_management', label: 'Pain management' },
  { key: 'perineal_care', label: 'Perineal care' },
  { key: 'personal_hygiene_care', label: 'Personal hygiene care' },
  { key: 'pigtail_dressing', label: 'Pigtail dressing' },
  { key: 'pr_examination_manual_evacuation', label: 'PR examination and manual evacuation' },
  { key: 'pressure_sore_management', label: 'Pressure sore management' },
  { key: 'rom_exercises', label: 'ROM exercises' },
  { key: 'sitz_bath', label: 'Sitz bath' },
  { key: 'skin_hygiene', label: 'Skin hygiene' },
  { key: 'steam_inhalation', label: 'Steam inhalation' },
  { key: 'tracheostomy_care', label: 'Tracheostomy care' },
  { key: 'vitals_monitoring', label: 'Vitals monitoring' },
  { key: 'wound_care', label: 'Wound care' },
];

const PHYSIO_PROCEDURES = [
  { key: 'adl_exercises', label: 'ADL exercises' },
  { key: 'adl_modifications', label: 'ADL modifications' },
  { key: 'ambulation_and_positioning', label: 'Ambulation and Positioning' },
  { key: 'brace_support_prescription', label: 'Brace support/prescription' },
  { key: 'breathing_exercises', label: 'Breathing exercises' },
  { key: 'caregiver_education_physio', label: 'Caregiver education' },
  { key: 'chest_physiotherapy', label: 'Chest physiotherapy' },
  { key: 'contracture_stiffness_management', label: 'Contracture and stiffness management' },
  { key: 'core_strengthening_exercises', label: 'Core strengthening exercises' },
  { key: 'lymphedema_bandaging', label: 'Lymphedema bandaging' },
  { key: 'lymphedema_drainage', label: 'Lymphedema drainage' },
  { key: 'lymphedema_exercises', label: 'Lymphedema exercises' },
  { key: 'others_physio', label: 'Others' },
  { key: 'referral_for_regular_physiotherapy', label: 'Referral for regular physiotherapy' },
  { key: 'rom_exercises', label: 'ROM exercises' },
  { key: 'spirometry', label: 'Spirometry' },
];

const COUNSELLOR_PROCEDURES = [
  { key: 'act_informed_interventions', label: 'ACT informed interventions' },
  { key: 'bereavement_care', label: 'Bereavement care' },
  { key: 'breaking_bad_news', label: 'Breaking bad news' },
  { key: 'caregiver_emotional_support', label: 'Caregiver emotional support' },
  { key: 'cbt_informed_interventions', label: 'CBT informed interventions' },
  { key: 'collusion_management', label: 'Collusion management' },
  { key: 'counselling_intervention', label: 'Counselling intervention' },
  { key: 'diagnosis_and_prognosis_counselling', label: 'Diagnosis and Prognosis counselling' },
  { key: 'dignity_conserving_intervention', label: 'Dignity conserving intervention' },
  { key: 'distraction_technique', label: 'Distraction technique' },
  { key: 'end_of_life_counselling', label: 'End of life counselling' },
  { key: 'existential_meaning_centred_intervention', label: 'Existential/meaning centred intervention' },
  { key: 'family_counselling', label: 'Family counselling' },
  { key: 'grief_support', label: 'Grief support' },
  { key: 'journalling', label: 'Journalling' },
  { key: 'legacy_document_creation', label: 'Legacy document creation' },
  { key: 'memory_making', label: 'Memory making' },
  { key: 'others_counselling', label: 'Others' },
  { key: 'psychoeducation', label: 'Psychoeducation' },
  { key: 'relaxation_techniques', label: 'Relaxation techniques' },
  { key: 'sleep_hygiene', label: 'Sleep hygiene' },
  { key: 'supportive_psychotherapy', label: 'Supportive psychotherapy' },
];

const MEDICAL_PROCEDURES = [
  { key: 'ascites_tapping', label: 'Ascites Tapping' },
  { key: 'crisis_plan_for_breathlessness', label: 'Crisis plan for breathlessness' },
  { key: 'crisis_plan_for_fall', label: 'Crisis plan for fall' },
  { key: 'crisis_plan_for_hemorrhage', label: 'Crisis plan for hemorrhage' },
  { key: 'crisis_plan_for_maggots', label: 'Crisis plan for maggots' },
  { key: 'crisis_plan_for_syncope', label: 'Crisis plan for syncope' },
  { key: 'death_plan', label: 'Death plan' },
  { key: 'diagnosis_and_prognosis_counselling', label: 'Diagnosis and Prognosis counselling' },
  { key: 'dpm_referrals', label: 'DPM (Dept of Palliative Medicine) referrals' },
  { key: 'end_of_life_counselling', label: 'End of life counselling' },
  { key: 'enema', label: 'Enema' },
  { key: 'initial_assessment', label: 'Initial assessment' },
  { key: 'iv_injections', label: 'IV injections' },
  { key: 'medication_review', label: 'Medication review' },
  { key: 'medicines_prescribed', label: 'Medicines prescribed' },
  { key: 'referral_to_start_morphine', label: 'Referral to start morphine' },
  { key: 'reorientation_technique', label: 'Reorientation technique' },
];

// ─── Checkbox grid sub-component ────────────────────────────────
function ProcedureCheckboxGroup({ title, color, procedures, selected, onChange }) {
  const [customInput, setCustomInput] = useState('');

  const predefinedKeys = procedures.map(p => p.key);
  const customEntries = selected.filter(s => !predefinedKeys.includes(s));

  const toggle = (key) => {
    const set = new Set(selected);
    if (set.has(key)) set.delete(key); else set.add(key);
    onChange([...set]);
  };

  const addCustom = () => {
    const value = customInput.trim();
    if (!value) return;
    if (selected.includes(value)) {
      setCustomInput('');
      return;
    }
    onChange([...selected, value]);
    setCustomInput('');
  };

  const removeCustom = (value) => {
    onChange(selected.filter(s => s !== value));
  };

  return (
    <div>
      <h5 className={`text-xs font-bold ${color} mb-2`}>{title}</h5>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5">
        {procedures.map(p => (
          <label key={p.key} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(p.key)}
              onChange={() => toggle(p.key)}
              className="h-3.5 w-3.5 rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-foreground group-hover:text-blue-600 transition-colors">{p.label}</span>
          </label>
        ))}
      </div>

      {/* Custom procedure entries */}
      {customEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {customEntries.map(entry => (
            <span key={entry} className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-full border border-border bg-muted/30 text-foreground">
              {entry}
              <button onClick={() => removeCustom(entry)} className="hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add custom procedure */}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          placeholder="Add custom procedure..."
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          className="flex-1 px-2.5 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs"
        />
        <button onClick={addCustom} type="button"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-border text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────
export default function ProceduresSection({ visitId, patientId, onSaved }) {
  const [nursing, setNursing] = useState([]);
  const [physiotherapy, setPhysiotherapy] = useState([]);
  const [counsellor, setCounsellor] = useState([]);
  const [medical, setMedical] = useState([]);
  const [customNursing, setCustomNursing] = useState([]);
  const [customPhysiotherapy, setCustomPhysiotherapy] = useState([]);
  const [customCounsellor, setCustomCounsellor] = useState([]);
  const [customMedical, setCustomMedical] = useState([]);
  const [exerciseReviewNotes, setExerciseReviewNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    saranamApi.getAssessment(visitId, 'procedures')
      .then(data => {
        if (active && data) {
          setCustomNursing(data.custom_nursing || []);
          setCustomPhysiotherapy(data.custom_physiotherapy || []);
          setCustomCounsellor(data.custom_counsellor || []);
          setCustomMedical(data.custom_medical || []);
          setNursing(data.nursing || []);
          setPhysiotherapy(data.physiotherapy || []);
          setCounsellor(data.counsellor || []);
          setMedical(data.medical || []);
          setExerciseReviewNotes(data.exercise_review || '');
          setNotes(data.notes || '');
        }
      })
      .catch(() => { })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visitId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saranamApi.saveAssessment(visitId, 'procedures', {
        nursing, physiotherapy, counsellor, medical, notes,
        exercise_review: exerciseReviewNotes,
        custom_nursing: customNursing,
        custom_physiotherapy: customPhysiotherapy,
        custom_counsellor: customCounsellor,
        custom_medical: customMedical,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save procedures');
    } finally { setSaving(false); }
  };

  const totalSelected = nursing.length + physiotherapy.length + counsellor.length + medical.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-emerald-600" />
          <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Procedures</h4>
          {totalSelected > 0 && (
            <span className="text-xs bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-200 px-2 py-0.5 rounded-full">
              {totalSelected} selected
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Nursing */}
        <ProcedureCheckboxGroup
          title="Nursing Procedures"
          color="text-blue-700 dark:text-blue-300"
          procedures={NURSING_PROCEDURES}
          selected={nursing}
          onChange={(v) => {
            setNursing(v);
            setSaved(false);
          }}
        />

        {/* Physiotherapy */}
        <ProcedureCheckboxGroup
          title="Physiotherapist Services"
          color="text-purple-700 dark:text-purple-300"
          procedures={PHYSIO_PROCEDURES}
          selected={physiotherapy}
          onChange={(v) => {
            setPhysiotherapy(v);
            setSaved(false);
          }}
        />

        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Exercise Review
          </label>

          <textarea
            rows={3}
            value={exerciseReviewNotes}
            onChange={(e) => {
              setExerciseReviewNotes(e.target.value);
              setSaved(false);
            }}
            placeholder="Document exercise review..."
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
          />
        </div>

        {/* Counsellor */}
        <ProcedureCheckboxGroup
          title="Counsellor Services"
          color="text-amber-700 dark:text-amber-300"
          procedures={COUNSELLOR_PROCEDURES}
          selected={counsellor}
          onChange={(v) => {
            setCounsellor(v);
            setSaved(false);
          }}
        />

        {/*Medical */}
        <ProcedureCheckboxGroup
          title="Doctor Interventions"
          color="text-pink-700 dark:text-pink-300"
          procedures={MEDICAL_PROCEDURES}
          selected={medical}
          onChange={(v) => {
            setMedical(v);
            setSaved(false);
          }}
        />

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Procedure Notes</label>
          <textarea
            rows={2}
            placeholder="Additional notes about procedures performed..."
            value={notes}
            onChange={e => { setNotes(e.target.value); setSaved(false); }}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-none"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Procedures'}
          </button>
        </div>
      </div>
    </div>
  );
}
